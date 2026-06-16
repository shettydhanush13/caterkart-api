import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { sanitizeDeep as sanitize, toObjectId } from '../common/utils';

const COLLECTION = 'Combos';

@Injectable()
export class CombosService {
  private readonly logger = new Logger(CombosService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  private toList(v: any): string[] {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  }

  // choice options: each is a selectable dish with an optional add-on price
  //   { name, price }   (price is added on top of the combo's base price)
  private toOptions(v: any): Array<{ name: string; price: number }> {
    if (typeof v === 'string') {
      return this.toList(v).map((name) => ({ name, price: 0 }));
    }
    if (!Array.isArray(v)) return [];
    return v
      .map((o) =>
        typeof o === 'string'
          ? { name: o.trim(), price: 0 }
          : { name: String(o?.name || '').trim(), price: Number(o?.price) || 0 },
      )
      .filter((o) => o.name);
  }

  private normalize(data: Record<string, any>): Record<string, any> {
    const doc = sanitize(data) || {};
    delete doc._id;
    if (doc.boxType != null) doc.boxType = Number(doc.boxType) || 0;
    if (doc.price != null) doc.price = Number(doc.price) || 0;

    // a combo can belong to several meal slots (e.g. Breakfast + Lunch/Dinner).
    // accept either mealSlots[] or a legacy single mealSlot.
    const slots = Array.isArray(doc.mealSlots)
      ? doc.mealSlots
      : doc.mealSlot
        ? [doc.mealSlot]
        : [];
    doc.mealSlots = slots.map((s: any) => String(s).trim()).filter(Boolean);
    doc.mealSlot = doc.mealSlots[0] || ''; // keep for legacy readers / sorting
    doc.vendor = String(doc.vendor || '').trim(); // supplier behind this combo

    // items: each entry is either a fixed dish or a choosable slot
    //   { kind: 'fixed',  name }
    //   { kind: 'choice', label, category, options: [{ name, price }] }
    const items = Array.isArray(doc.items) ? doc.items : [];
    doc.items = items.map((it: any) => {
      if (typeof it === 'string') return { kind: 'fixed', name: it.trim() };
      const kind = it && it.kind === 'choice' ? 'choice' : 'fixed';
      if (kind === 'choice') {
        return {
          kind,
          label: String(it.label || '').trim(),
          category: String(it.category || '').trim(),
          options: this.toOptions(it.options),
        };
      }
      return { kind: 'fixed', name: String(it.name || '').trim() };
    });

    // items included free with every box (tissues, cutlery, water, …)
    doc.commonItems = this.toList(doc.commonItems);
    // optional paid extras the customer can add (dessert, soft drink, …)
    doc.addOns = this.toOptions(doc.addOns);

    if (doc.active === undefined) doc.active = true;
    return doc;
  }

  async list(filter: { mealSlot?: string; boxType?: number } = {}): Promise<any[]> {
    try {
      const q: Record<string, any> = {};
      // match combos whose mealSlots[] contains the slot (or legacy mealSlot).
      if (filter.mealSlot) {
        q.$or = [{ mealSlots: filter.mealSlot }, { mealSlot: filter.mealSlot }];
      }
      if (filter.boxType != null && !Number.isNaN(Number(filter.boxType))) {
        q.boxType = Number(filter.boxType);
      }
      return await this.coll
        .find(q)
        .sort({ mealSlot: 1, boxType: 1, name: 1 })
        .toArray();
    } catch (err) {
      this.logger.error('Failed to list combos', err);
      throw new InternalServerErrorException('Failed to list combos');
    }
  }

  async create(data: Record<string, any>): Promise<any> {
    if (!data || typeof data !== 'object') throw new BadRequestException('Invalid combo');
    try {
      const doc = { ...this.normalize(data), createdAt: new Date(), updatedAt: new Date() };
      const res = await this.coll.insertOne(doc as any);
      return { _id: res.insertedId, ...doc };
    } catch (err) {
      this.logger.error('Failed to create combo', err);
      throw new InternalServerErrorException('Failed to create combo');
    }
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    try {
      const _id = toObjectId(id);
      const patch = { ...this.normalize(data), updatedAt: new Date() };
      await this.coll.updateOne({ _id } as any, { $set: patch });
      return await this.coll.findOne({ _id } as any);
    } catch (err) {
      this.logger.error('Failed to update combo', err);
      throw new InternalServerErrorException('Failed to update combo');
    }
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    try {
      const _id = toObjectId(id);
      await this.coll.deleteOne({ _id } as any);
      return { ok: true };
    } catch (err) {
      this.logger.error('Failed to delete combo', err);
      throw new InternalServerErrorException('Failed to delete combo');
    }
  }
}
