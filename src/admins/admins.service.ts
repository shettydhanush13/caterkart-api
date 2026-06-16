import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { normalizePhone, toObjectId } from '../common/utils';

const COLLECTION = 'Admins';

// Bootstrap admin(s) — always treated as full admin and cannot be removed.
const CORE_ADMINS = ['8971780778'];

export type AdminType = 'admin' | 'vendor';

export interface AdminProfile {
  isAdmin: boolean;
  type?: AdminType;
  vendorName?: string;
  name?: string;
  phone?: string;
}

@Injectable()
export class AdminsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminsService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  // Seed the bootstrap admin(s) once at boot rather than on every list() call.
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.connection.asPromise();
      await this.ensureCore();
    } catch (err) {
      this.logger.error('Failed to ensure core admin', err);
    }
  }

  private async ensureCore(): Promise<void> {
    for (const phone of CORE_ADMINS) {
      await this.coll.updateOne(
        { phone },
        {
          $set: { type: 'admin' },
          $setOnInsert: { phone, name: 'Core Admin', core: true, active: true, createdAt: new Date() },
        },
        { upsert: true },
      );
    }
  }

  async isAdmin(phone: string): Promise<boolean> {
    return (await this.profile(phone)).isAdmin;
  }

  // role + scope for a phone number (used by the app after OTP verification)
  async profile(phone: string): Promise<AdminProfile> {
    const p = normalizePhone(phone);
    if (!p) return { isAdmin: false };
    if (CORE_ADMINS.includes(p)) {
      return { isAdmin: true, type: 'admin', vendorName: '', name: 'Core Admin', phone: p };
    }
    try {
      const doc = await this.coll.findOne({ phone: p });
      if (doc && doc.active !== false) {
        return {
          isAdmin: true,
          type: (doc.type as AdminType) || 'admin',
          vendorName: doc.vendorName || '',
          name: doc.name || 'Admin',
          phone: p,
        };
      }
    } catch (err) {
      this.logger.error('profile lookup failed', err);
    }
    return { isAdmin: false };
  }

  async list(): Promise<any[]> {
    try {
      return await this.coll.find({}).sort({ createdAt: 1 }).toArray();
    } catch (err) {
      this.logger.error('Failed to list admins', err);
      throw new InternalServerErrorException('Failed to list admins');
    }
  }

  async create(data: Record<string, any>): Promise<any> {
    const phone = normalizePhone(data?.phone);
    if (phone.length !== 10) throw new BadRequestException('Enter a valid 10-digit phone number');
    const name = String(data?.name || '').trim() || 'Admin';
    const type: AdminType = data?.type === 'vendor' ? 'vendor' : 'admin';
    const vendorName = String(data?.vendorName || '').trim();
    try {
      await this.coll.updateOne(
        { phone },
        { $set: { phone, name, type, vendorName, active: true }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      return await this.coll.findOne({ phone });
    } catch (err) {
      this.logger.error('Failed to create admin', err);
      throw new InternalServerErrorException('Failed to create admin');
    }
  }

  // link/sync a vendor as a restricted "vendor" admin (called when a vendor is saved).
  // If the phone is already a FULL admin, keep them admin — don't downgrade.
  async upsertVendorAdmin(phone: string, vendorName: string): Promise<void> {
    const p = normalizePhone(phone);
    if (p.length !== 10) return;
    try {
      const existing = await this.coll.findOne({ phone: p });
      const isFullAdmin =
        CORE_ADMINS.includes(p) || (existing && (existing.core || existing.type === 'admin'));
      if (isFullAdmin) {
        // keep their admin role; just record the linked vendor name
        await this.coll.updateOne({ phone: p }, { $set: { vendorName: vendorName || existing?.vendorName || '' } });
        return;
      }
      await this.coll.updateOne(
        { phone: p },
        {
          $set: { phone: p, name: vendorName || 'Vendor', type: 'vendor', vendorName: vendorName || '', active: true },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error('Failed to upsert vendor admin', err);
    }
  }

  async removeByPhone(phone: string): Promise<void> {
    const p = normalizePhone(phone);
    if (!p || CORE_ADMINS.includes(p)) return;
    try {
      await this.coll.deleteOne({ phone: p, type: 'vendor' } as any);
    } catch (err) {
      this.logger.error('Failed to remove vendor admin', err);
    }
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    try {
      const _id = toObjectId(id);
      const doc = await this.coll.findOne({ _id } as any);
      if (doc && (doc.core || CORE_ADMINS.includes(String(doc.phone)))) {
        throw new BadRequestException('The core admin cannot be removed');
      }
      await this.coll.deleteOne({ _id } as any);
      return { ok: true };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to delete admin', err);
      throw new InternalServerErrorException('Failed to delete admin');
    }
  }
}
