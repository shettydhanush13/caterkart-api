import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const COLLECTION = 'Pincodes';

const toObjectId = (id: string): any => {
  try {
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
  } catch {
    /* fall through */
  }
  return id;
};

const normalizePincode = (p: any): string => String(p || '').replace(/\D/g, '').slice(0, 6);

// Best-effort Bengaluru pincode → zone seed. Numbers are the trailing part of a
// 560xxx pincode; anything in 560001–560110 not listed defaults to Central.
// (Approximate — editable from the admin Pincodes page.)
const ZONE_DIGITS: Record<string, number[]> = {
  'Bangalore-North': [13, 14, 15, 22, 24, 32, 54, 57, 63, 64, 65, 73, 77, 89, 90, 92, 94, 96, 97, 106, 107],
  'Bangalore-South': [4, 11, 19, 28, 29, 30, 34, 35, 41, 50, 61, 62, 68, 69, 70, 76, 78, 81, 83, 85, 95, 99, 100, 102, 105, 108, 109],
  'Bangalore-East': [16, 17, 36, 37, 38, 43, 48, 49, 66, 67, 71, 75, 87, 88, 93, 101, 103],
  'Bangalore-West': [10, 21, 23, 26, 39, 40, 44, 55, 56, 58, 59, 60, 72, 74, 79, 86, 91, 98, 104, 110],
  'Bangalore-Central': [1, 2, 3, 5, 6, 7, 8, 9, 18, 20, 25, 27, 33, 42, 45, 46, 47, 51, 52, 53, 80, 82, 84],
};

function buildBangaloreSeed(): Array<{ pincode: string; area: string }> {
  const map = new Map<string, string>();
  for (const [area, digits] of Object.entries(ZONE_DIGITS)) {
    for (const n of digits) map.set(`5600${String(n).padStart(2, '0')}`.slice(0, 6), area);
  }
  // fill any gap in 560001–560110 with Central so all of the city is covered
  for (let n = 1; n <= 110; n++) {
    const pin = `560${String(n).padStart(3, '0')}`;
    if (!map.has(pin)) map.set(pin, 'Bangalore-Central');
  }
  // a few outskirts
  map.set('560300', 'Bangalore-North'); // Yelahanka
  map.set('562157', 'Bangalore-North');
  return Array.from(map.entries()).map(([pincode, area]) => ({ pincode, area }));
}

@Injectable()
export class PincodesService {
  private readonly logger = new Logger(PincodesService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  // seed Bengaluru pincodes once, only when the collection is empty
  private async ensureSeeded(): Promise<void> {
    try {
      const count = await this.coll.estimatedDocumentCount();
      if (count > 0) return;
      const now = new Date();
      const docs = buildBangaloreSeed().map((d) => ({ ...d, city: 'Bengaluru', active: true, createdAt: now }));
      if (docs.length) await this.coll.insertMany(docs as any, { ordered: false }).catch(() => undefined);
    } catch (err) {
      this.logger.error('Failed to seed pincodes', err);
    }
  }

  private normalize(data: Record<string, any>): Record<string, any> {
    return {
      pincode: normalizePincode(data?.pincode),
      area: String(data?.area || '').trim(),
      city: String(data?.city || 'Bengaluru').trim(),
      active: data?.active === undefined ? true : !!data.active,
    };
  }

  async list(): Promise<any[]> {
    try {
      await this.ensureSeeded();
      return await this.coll.find({}).sort({ area: 1, pincode: 1 }).toArray();
    } catch (err) {
      this.logger.error('Failed to list pincodes', err);
      throw new InternalServerErrorException('Failed to list pincodes');
    }
  }

  async create(data: Record<string, any>): Promise<any> {
    const doc = this.normalize(data);
    if (doc.pincode.length !== 6) throw new BadRequestException('Enter a valid 6-digit pincode');
    if (!doc.area) throw new BadRequestException('Area is required');
    try {
      await this.coll.updateOne(
        { pincode: doc.pincode },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      return await this.coll.findOne({ pincode: doc.pincode });
    } catch (err) {
      this.logger.error('Failed to create pincode', err);
      throw new InternalServerErrorException('Failed to create pincode');
    }
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    try {
      const _id = toObjectId(id);
      await this.coll.updateOne({ _id } as any, { $set: { ...this.normalize(data), updatedAt: new Date() } });
      return await this.coll.findOne({ _id } as any);
    } catch (err) {
      this.logger.error('Failed to update pincode', err);
      throw new InternalServerErrorException('Failed to update pincode');
    }
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    try {
      const _id = toObjectId(id);
      await this.coll.deleteOne({ _id } as any);
      return { ok: true };
    } catch (err) {
      this.logger.error('Failed to delete pincode', err);
      throw new InternalServerErrorException('Failed to delete pincode');
    }
  }

  // resolve a pincode to its area, then check vendor coverage for that area
  async serviceability(pincode: string): Promise<{
    pincode: string;
    serviceable: boolean;
    area: string;
    vendorCount: number;
    vendors: string[];
    notConfigured?: boolean;
  }> {
    const p = normalizePincode(pincode);
    const empty = { pincode: p, serviceable: false, area: '', vendorCount: 0, vendors: [] as string[] };
    if (p.length !== 6) return empty;
    try {
      await this.ensureSeeded();
      // until any pincodes are configured, don't block orders (feature not set up yet)
      const total = await this.coll.estimatedDocumentCount();
      if (total === 0) return { ...empty, serviceable: true, notConfigured: true };

      const doc = await this.coll.findOne({ pincode: p });
      if (!doc || doc.active === false || !doc.area) return empty;
      const area = doc.area as string;
      const vendors = await this.connection
        .collection('Vendors')
        .find({ serviceAreas: area, active: { $ne: false } }, { projection: { name: 1 } })
        .toArray();
      const names = vendors.map((v) => v.name).filter(Boolean);
      return { pincode: p, serviceable: names.length > 0, area, vendorCount: names.length, vendors: names };
    } catch (err) {
      this.logger.error('Serviceability check failed', err);
      return empty;
    }
  }
}
