import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AdminsService } from '../admins/admins.service';

// Strip keys that could be used for NoSQL operator/path injection.
function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj !== 'object') return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k !== 'string') continue;
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = sanitize(v);
  }
  return out;
}

const toObjectId = (id: string): any => {
  try {
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
  } catch {
    /* fall through */
  }
  return id;
};

const COLLECTION = 'Vendors';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly admins: AdminsService,
  ) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  private toList(v: any): string[] {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  }

  private normalize(data: Record<string, any>): Record<string, any> {
    const doc = sanitize(data) || {};
    delete doc._id;
    doc.name = String(doc.name || '').trim();
    doc.phone = String(doc.phone || '').trim();
    doc.email = String(doc.email || '').trim();
    doc.area = String(doc.area || '').trim();
    doc.notes = String(doc.notes || '').trim();
    doc.fssaiNumber = String(doc.fssaiNumber || '').trim();
    // regions this vendor can deliver to (moved here from the food item)
    doc.serviceAreas = this.toList(doc.serviceAreas);
    if (doc.active === undefined) doc.active = true;
    return doc;
  }

  async list(): Promise<any[]> {
    try {
      return await this.coll.find({}).sort({ name: 1 }).toArray();
    } catch (err) {
      this.logger.error('Failed to list vendors', err);
      throw new InternalServerErrorException('Failed to list vendors');
    }
  }

  async create(data: Record<string, any>): Promise<any> {
    if (!data || typeof data !== 'object') throw new BadRequestException('Invalid vendor');
    const doc: Record<string, any> = { ...this.normalize(data), createdAt: new Date(), updatedAt: new Date() };
    if (!doc.name) throw new BadRequestException('Vendor name is required');
    try {
      const res = await this.coll.insertOne(doc as any);
      // give the vendor restricted "vendor" admin access via their phone number
      if (doc.phone) await this.admins.upsertVendorAdmin(doc.phone, doc.name);
      return { _id: res.insertedId, ...doc };
    } catch (err) {
      this.logger.error('Failed to create vendor', err);
      throw new InternalServerErrorException('Failed to create vendor');
    }
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    try {
      const _id = toObjectId(id);
      const patch = { ...this.normalize(data), updatedAt: new Date() };
      await this.coll.updateOne({ _id } as any, { $set: patch });
      const updated = await this.coll.findOne({ _id } as any);
      // keep the linked vendor-admin in sync (name / phone changes)
      if (updated && updated.phone) await this.admins.upsertVendorAdmin(updated.phone, updated.name);
      return updated;
    } catch (err) {
      this.logger.error('Failed to update vendor', err);
      throw new InternalServerErrorException('Failed to update vendor');
    }
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    try {
      const _id = toObjectId(id);
      const doc = await this.coll.findOne({ _id } as any);
      await this.coll.deleteOne({ _id } as any);
      if (doc && doc.phone) await this.admins.removeByPhone(doc.phone);
      return { ok: true };
    } catch (err) {
      this.logger.error('Failed to delete vendor', err);
      throw new InternalServerErrorException('Failed to delete vendor');
    }
  }
}
