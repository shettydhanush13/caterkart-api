import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { InvoicingService } from '../invoicing/invoicing.service';
import { normalizePhone, toObjectId } from '../common/utils';

const COLLECTION = 'Subscriptions';

// No automatic bulk discount — discounts are negotiated by the team during
// quote generation and supplied as `discountPct`.
const clampPct = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly invoicing: InvoicingService,
  ) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  /**
   * Allocate a sequential weekly tax-invoice number (series SUB) for one week of
   * a subscription, exactly once per week. Numbers are stored under
   * `weeklyInvoiceNos[weekKey]`; a repeat call for the same week returns it.
   */
  async assignWeeklyInvoice(id: string, weekKey: string): Promise<{ week: string; invoiceNo: string }> {
    const _id = toObjectId(id);
    const sub: any = await this.coll.findOne({ _id } as any);
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);

    // sanitise the week key — it becomes part of a dotted field path
    const key = (String(weekKey || '').replace(/[^A-Za-z0-9_-]/g, '_') || 'W1').slice(0, 40);
    const existing = sub.weeklyInvoiceNos?.[key];
    if (existing) return { week: key, invoiceNo: existing };

    const number = await this.invoicing.allocate('SUB', sub.startDate || undefined);
    const field = `weeklyInvoiceNos.${key}`;
    const res: any = await this.coll.findOneAndUpdate(
      { _id, [field]: { $exists: false } } as any,
      { $set: { [field]: number } },
      { returnDocument: 'after' },
    );
    const doc = (res && res.value) || res;
    if (!doc) {
      // lost the race — return whoever's number won for this week
      const fresh: any = await this.coll.findOne({ _id } as any);
      return { week: key, invoiceNo: fresh?.weeklyInvoiceNos?.[key] || number };
    }
    return { week: key, invoiceNo: number };
  }

  async create(data: CreateSubscriptionDto): Promise<any> {
    const contactName = String(data?.contactName || '').trim();
    const phone = normalizePhone(data?.phone);
    const pincode = String(data?.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!contactName) throw new BadRequestException('Your name is required');
    if (phone.length !== 10) throw new BadRequestException('A valid 10-digit phone number is required');
    if (pincode.length !== 6) throw new BadRequestException('A valid 6-digit pincode is required');

    const now = new Date();
    const doc: Record<string, any> = {
      contactName,
      phone,
      email: String(data?.email || '').trim().slice(0, 160),
      organisation: String(data?.organisation || '').trim().slice(0, 160),
      pincode,
      mealSlot: data?.mealSlot || '',
      boxType: data?.boxType ? Number(data.boxType) : null,
      totalMeals: data?.totalMeals ? Number(data.totalMeals) : null,
      durationValue: data?.durationValue ? Number(data.durationValue) : null,
      durationUnit: data?.durationUnit || '',
      frequency: data?.frequency || '',
      startDate: String(data?.startDate || '').slice(0, 40),
      endDate: String(data?.endDate || '').slice(0, 40),
      ongoing: data?.ongoing != null ? !!data.ongoing : !String(data?.endDate || '').trim(),
      reusableCarrier: !!data?.reusableCarrier,
      coBranded: !!data?.coBranded,
      preferredCombos: Array.isArray(data?.preferredCombos)
        ? data.preferredCombos.map((c) => String(c).trim()).filter(Boolean).slice(0, 50)
        : [],
      comboPlan: [], // per-combo "times a week", set by the team during planning
      paymentType: '', // weekly | monthly, set by the team
      notes: String(data?.notes || '').trim().slice(0, 2000),
      discountPct: clampPct(data?.discountPct), // negotiated by the team (0 by default)
      status: 'new',
      adminNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    const idempotencyKey =
      typeof data?.idempotencyKey === 'string' && data.idempotencyKey.trim()
        ? data.idempotencyKey.trim().slice(0, 100)
        : undefined;

    try {
      if (!idempotencyKey) {
        const res = await this.coll.insertOne(doc as any);
        return { _id: res.insertedId, ...doc };
      }
      // idempotent upsert: a retry with the same key returns the original lead
      doc.idempotencyKey = idempotencyKey;
      const saved = await this.coll.findOneAndUpdate(
        { idempotencyKey },
        { $setOnInsert: doc },
        { upsert: true, returnDocument: 'after' },
      );
      // driver v5+ returns the doc directly; older returns { value }
      return (saved && (saved as any).value) || saved || doc;
    } catch (err: any) {
      // concurrent same-key race on the unique index → return the winner's doc
      if (err?.code === 11000 && idempotencyKey) {
        const existing = await this.coll.findOne({ idempotencyKey });
        if (existing) return existing;
      }
      this.logger.error('Failed to create subscription', err);
      throw new InternalServerErrorException('Failed to create subscription');
    }
  }

  async list(
    opts: { status?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: any[]; page: number; limit: number; total: number }> {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 100));
    const filter: Record<string, any> = {};
    if (opts.status && typeof opts.status === 'string') filter.status = opts.status;
    try {
      const [data, total] = await Promise.all([
        this.coll
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        this.coll.countDocuments(filter),
      ]);
      return { data, page, limit, total };
    } catch (err) {
      this.logger.error('Failed to list subscriptions', err);
      throw new InternalServerErrorException('Failed to list subscriptions');
    }
  }

  async findById(id: string): Promise<any | null> {
    try {
      return await this.coll.findOne({ _id: toObjectId(id) } as any);
    } catch (err) {
      this.logger.error('Failed to fetch subscription', err);
      throw new InternalServerErrorException('Failed to fetch subscription');
    }
  }

  async update(id: string, body: UpdateSubscriptionDto): Promise<any> {
    const patch: Record<string, any> = { updatedAt: new Date() };
    const b: any = body || {};

    if (typeof b.contactName === 'string') patch.contactName = b.contactName.trim().slice(0, 120);
    if (typeof b.phone === 'string') patch.phone = normalizePhone(b.phone);
    if (typeof b.email === 'string') patch.email = b.email.trim().slice(0, 160);
    if (typeof b.organisation === 'string') patch.organisation = b.organisation.trim().slice(0, 160);
    if (typeof b.pincode === 'string') patch.pincode = b.pincode.replace(/\D/g, '').slice(0, 6);
    if (typeof b.mealSlot === 'string') patch.mealSlot = b.mealSlot;
    if (b.boxType != null) patch.boxType = Number(b.boxType);
    if (b.totalMeals != null) patch.totalMeals = Number(b.totalMeals);
    if (b.discountPct != null) patch.discountPct = clampPct(b.discountPct); // negotiated %
    if (b.durationValue != null) patch.durationValue = Number(b.durationValue);
    if (typeof b.durationUnit === 'string') patch.durationUnit = b.durationUnit;
    if (typeof b.frequency === 'string') patch.frequency = b.frequency;
    if (typeof b.startDate === 'string') patch.startDate = b.startDate.slice(0, 40);
    if (typeof b.endDate === 'string') patch.endDate = b.endDate.slice(0, 40);
    if (typeof b.ongoing === 'boolean') patch.ongoing = b.ongoing;
    if (typeof b.reusableCarrier === 'boolean') patch.reusableCarrier = b.reusableCarrier;
    if (typeof b.coBranded === 'boolean') patch.coBranded = b.coBranded;
    if (Array.isArray(b.deliveries)) {
      patch.deliveries = b.deliveries
        .map((d: any) => ({
          date: String(d?.date || '').slice(0, 40),
          combo: String(d?.combo || '').slice(0, 120),
          people: Number(d?.people) || 0,
          delivered: !!d?.delivered,
          deliveredAt: d?.deliveredAt ? String(d.deliveredAt).slice(0, 40) : '',
        }))
        .filter((d: any) => d.date)
        .slice(0, 1000);
    }
    if (Array.isArray(b.preferredCombos)) {
      patch.preferredCombos = b.preferredCombos.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 50);
    }
    if (b.payouts && typeof b.payouts === 'object' && !Array.isArray(b.payouts)) {
      // per-week vendor settlement, keyed by ISO week-start (yyyy-mm-dd)
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(b.payouts)) {
        if (typeof k !== 'string' || k.startsWith('$') || k.includes('.')) continue;
        const p: any = v || {};
        out[k.slice(0, 40)] = {
          paid: !!p.paid,
          method: ['bank', 'upi', 'cash'].includes(p.method) ? p.method : 'bank',
          paidAt: p.paidAt ? String(p.paidAt).slice(0, 40) : null,
          amount: Number(p.amount) || 0,
        };
      }
      patch.payouts = out;
    }
    if (b.weekPayments && typeof b.weekPayments === 'object' && !Array.isArray(b.weekPayments)) {
      // per-week customer payment links, keyed by ISO week-start (yyyy-mm-dd)
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(b.weekPayments)) {
        if (typeof k !== 'string' || k.startsWith('$') || k.includes('.')) continue;
        const p: any = v || {};
        out[k.slice(0, 40)] = {
          linkUrl: p.linkUrl ? String(p.linkUrl).slice(0, 400) : '',
          linkId: p.linkId ? String(p.linkId).slice(0, 80) : '',
          amount: Number(p.amount) || 0,
          sentAt: p.sentAt ? String(p.sentAt).slice(0, 40) : null,
        };
      }
      patch.weekPayments = out;
    }
    if (Array.isArray(b.nextWeekCombos)) {
      patch.nextWeekCombos = b.nextWeekCombos.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 50);
    }
    if (Array.isArray(b.comboPlan)) {
      // strip $-prefixed / dotted keys from the choices map (NoSQL-injection safe)
      const safeChoices = (obj: any): Record<string, string> => {
        const out: Record<string, string> = {};
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            if (typeof k !== 'string' || k.startsWith('$') || k.includes('.')) continue;
            out[k.slice(0, 120)] = String(v ?? '').slice(0, 120);
          }
        }
        return out;
      };
      patch.comboPlan = b.comboPlan
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          perWeek: Number(x?.perWeek) || 0,
          people: Number(x?.people) || 0,
          choices: safeChoices(x?.choices),
          addOns: Array.isArray(x?.addOns) ? x.addOns.map((a: any) => String(a).trim()).filter(Boolean).slice(0, 20) : [],
          unitPrice: Number(x?.unitPrice) || 0,
        }))
        .filter((x: any) => x.name)
        .slice(0, 50);
    }
    if (typeof b.paymentType === 'string') patch.paymentType = b.paymentType;
    if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 2000);
    if (typeof b.status === 'string') patch.status = b.status;
    if (typeof b.adminNotes === 'string') patch.adminNotes = b.adminNotes.slice(0, 2000);

    if (Object.keys(patch).length === 1) {
      throw new BadRequestException('No updatable fields in payload');
    }
    try {
      const _id = toObjectId(id);
      const res = await this.coll.updateOne({ _id } as any, { $set: patch });
      if (!res.matchedCount) throw new NotFoundException('Subscription not found');
      return await this.coll.findOne({ _id } as any);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Failed to update subscription', err);
      throw new InternalServerErrorException('Failed to update subscription');
    }
  }
}
