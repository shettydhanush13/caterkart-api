import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AdminsService } from '../admins/admins.service';
import { sanitizeDeep as sanitize, toObjectId } from '../common/utils';

const COLLECTION = 'Vendors';

// Case-insensitive collation — equality matches use the `name_ci` index
// (a `$regex`/`$options:i` scan cannot).
const CI = { locale: 'en', strength: 2 } as const;

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

  // clamp a commission percentage to 0–100
  private pct(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
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
    // tax/billing details — used as the supplier of record on GST invoices
    doc.gstin = String(doc.gstin || '').trim().toUpperCase();
    doc.address = String(doc.address || '').trim();
    // regions this vendor can deliver to (moved here from the food item)
    doc.serviceAreas = this.toList(doc.serviceAreas);
    // CaterKart commission % (per onboarding agreement), separate per product line
    doc.caterboxCommissionPct = this.pct(doc.caterboxCommissionPct);
    doc.buffetCommissionPct = this.pct(doc.buffetCommissionPct);
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

  // customer-safe profile by name (FSSAI, areas, kitchen media — no PII)
  async publicByName(name: string): Promise<any> {
    const n = String(name || '').trim();
    if (!n) return null;
    try {
      const v = await this.coll.findOne({ name: n }, { collation: CI } as any);
      if (!v) return null;
      return {
        name: v.name,
        fssaiNumber: v.fssaiNumber || '',
        gstin: v.gstin || '',       // supplier-of-record details for the tax invoice
        address: v.address || '',
        serviceAreas: v.serviceAreas || [],
        city: v.city || '',
        kitchenPhotos: Array.isArray(v.kitchenPhotos) ? v.kitchenPhotos : [],
        kitchenVideos: Array.isArray(v.kitchenVideos) ? v.kitchenVideos : [],
        ratingAverage: Number(v.ratingAverage) || 0,
        ratingCount: Number(v.ratingCount) || 0,
        googleRating: Number(v.googleRating) || 0, // reserved for future Google import
        googleReviewCount: Number(v.googleReviewCount) || 0,
      };
    } catch (err) {
      this.logger.error('Failed public vendor lookup', err);
      return null;
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
