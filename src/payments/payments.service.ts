import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as crypto from 'crypto';
import { PricingService } from '../pricing/pricing.service';
import { toObjectId } from '../common/utils';
// razorpay is a CommonJS module (module.exports = Razorpay); esModuleInterop is
// off here, so the default import resolves to `undefined`. Use import-equals.
import Razorpay = require('razorpay');

const COLLECTION = 'Orders';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
    private readonly pricing: PricingService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  private get orders() {
    return this.connection.collection(COLLECTION);
  }

  // ─── Step 1: create a Razorpay order for a CaterKart order ──────────────────

  /**
   * Creates a Razorpay order for one CaterKart order (kind = advance | balance |
   * full). The frontend opens Razorpay Checkout with the returned params, then
   * calls POST /payments/verify once the user completes checkout.
   *
   * Returns: { orderId, amount, currency, keyId, name, description, prefill }
   */
  async createOrderPayment(orderId: string, kind = 'advance'): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    name: string;
    description: string;
    prefill: { name?: string; email?: string; contact?: string };
  }> {
    const doc = await this.orders.findOne({ _id: toObjectId(orderId) } as any);
    if (!doc) throw new NotFoundException('Order not found');

    const amountRupees = this.amountFor(doc, kind);
    if (amountRupees <= 0) throw new BadRequestException('Nothing left to pay for this order');

    const amount = this.toPaise(amountRupees);
    const order = await this.rzpCall(this.razorpay.orders.create({
      amount,
      currency: this.currency(),
      receipt: `ck_${String(orderId).slice(-8)}_${kind}`,
      notes: { orderId: String(orderId), kind },
    }));

    // record the open payment intent so verify/webhook can settle it
    await this.orders.updateOne(
      { _id: toObjectId(orderId) } as any,
      { $set: { razorpayOrderId: order.id, pendingPaymentAmount: amountRupees, pendingPaymentKind: kind } },
    );

    const cust = doc?.order?.customerData || doc?.order?.customer || {};
    this.logger.log(`Razorpay order created: ${order.id} for order=${orderId} kind=${kind} ₹${amountRupees}`);

    return {
      orderId: order.id,
      amount,
      currency: this.currency(),
      keyId: this.config.get<string>('RAZORPAY_KEY_ID') || '',
      name: 'CaterKart',
      description: `${kind === 'advance' ? 'Advance' : kind === 'balance' ? 'Balance' : 'Order'} payment`,
      prefill: { name: cust.name, email: cust.email, contact: cust.phone },
    };
  }

  // ─── Payment link: create a hosted Razorpay link & let Razorpay notify ─────

  /**
   * Creates a Razorpay Payment Link for an order's outstanding amount and asks
   * Razorpay to notify the customer over SMS + email. Returns { url, id }.
   * Settlement happens via the same webhook (`payment_link.paid`).
   */
  async createPaymentLink(orderId: string, kind = 'balance'): Promise<{ url: string; id: string; amount: number }> {
    const doc = await this.orders.findOne({ _id: toObjectId(orderId) } as any);
    if (!doc) throw new NotFoundException('Order not found');

    const amountRupees = this.amountFor(doc, kind);
    if (amountRupees <= 0) throw new BadRequestException('Nothing left to pay for this order');

    const cust = doc?.order?.customerData || doc?.order?.customer || {};
    const phone = String(cust.phone || '').replace(/\D/g, '').slice(-10);
    const eventType = doc?.order?.eventType || 'order';

    const link = await this.rzpCall(this.razorpay.paymentLink.create({
      amount: this.toPaise(amountRupees),
      currency: this.currency(),
      accept_partial: false,
      description: `CaterKart — ${kind === 'advance' ? 'advance' : kind === 'balance' ? 'balance' : 'payment'} for ${eventType}`,
      customer: {
        name: cust.name || 'Customer',
        contact: phone ? `+91${phone}` : undefined,
        email: cust.email || undefined,
      },
      notify: { sms: !!phone, email: !!cust.email },
      reminder_enable: true,
      notes: { orderId: String(orderId), kind },
    } as any));

    await this.orders.updateOne(
      { _id: toObjectId(orderId) } as any,
      { $set: { razorpayPaymentLinkId: (link as any).id, paymentLinkUrl: (link as any).short_url, pendingPaymentAmount: amountRupees, pendingPaymentKind: kind } },
    );

    this.logger.log(`Payment link created: ${(link as any).id} for order=${orderId} ₹${amountRupees}`);
    return { url: (link as any).short_url, id: (link as any).id, amount: amountRupees };
  }

  /**
   * Create a hosted Razorpay Payment Link for an explicit amount + customer.
   * Used by subscription weekly billing (not tied to the Orders collection).
   */
  async createDirectLink(input: {
    amount: number;
    name: string;
    phone?: string;
    email?: string;
    description?: string;
    notes?: Record<string, any>;
  }): Promise<{ url: string; id: string; amount: number }> {
    const amountRupees = Math.round(Number(input.amount) || 0);
    if (amountRupees <= 0) throw new BadRequestException('Amount must be greater than zero');

    const phone = String(input.phone || '').replace(/\D/g, '').slice(-10);
    const notes: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.notes || {})) {
      if (typeof k !== 'string' || k.startsWith('$') || k.includes('.')) continue;
      notes[k.slice(0, 40)] = String(v ?? '').slice(0, 200);
    }

    const link = await this.rzpCall(this.razorpay.paymentLink.create({
      amount: this.toPaise(amountRupees),
      currency: this.currency(),
      accept_partial: false,
      description: (input.description || 'CaterKart payment').slice(0, 200),
      customer: {
        name: input.name || 'Customer',
        contact: phone ? `+91${phone}` : undefined,
        email: input.email || undefined,
      },
      notify: { sms: !!phone, email: !!input.email },
      reminder_enable: true,
      notes,
    } as any));

    this.logger.log(`Direct payment link created: ${(link as any).id} ₹${amountRupees}`);
    return { url: (link as any).short_url, id: (link as any).id, amount: amountRupees };
  }

  // ─── Step 2: verify the Checkout signature, then mark the order paid ────────

  async verifyPayment(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ verified: boolean; order: any }> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');

    const expected = crypto
      .createHmac('sha256', secret || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const ok =
      !!razorpay_signature &&
      expected.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
    if (!ok) throw new BadRequestException('Invalid payment signature');

    const doc = await this.orders.findOne({ razorpayOrderId: razorpay_order_id } as any);
    if (!doc) throw new NotFoundException('Order for this payment not found');

    const amount = Number(doc.pendingPaymentAmount || 0);
    const order = await this.markPaid(String(doc._id), razorpay_payment_id, amount);
    return { verified: true, order };
  }

  // ─── Reconcile: pull status from Razorpay (no webhook needed) ──────────────

  /**
   * Fetches the live status of an order's payment link and/or checkout order from
   * Razorpay and records any captured payment. Idempotent (markPaid dedupes), so
   * it's safe to call on every order-details load / via a "refresh" button — and
   * it covers local/dev where the webhook can't reach the server.
   */
  async syncOrderPayment(orderId: string): Promise<any> {
    const _id = toObjectId(orderId);
    const doc = await this.orders.findOne({ _id } as any);
    if (!doc) throw new NotFoundException('Order not found');

    // 1) Payment link settlement
    if (doc.razorpayPaymentLinkId) {
      try {
        const link: any = await this.razorpay.paymentLink.fetch(doc.razorpayPaymentLinkId);
        if (link?.status === 'paid') {
          const amount = Number(link.amount_paid ?? link.amount ?? 0) / 100;
          const pid =
            (Array.isArray(link.payments) && link.payments[0] &&
              (link.payments[0].payment_id || link.payments[0].plink_id)) ||
            `plink_${doc.razorpayPaymentLinkId}`;
          await this.markPaid(orderId, pid, amount);
        }
      } catch (err) {
        this.logger.warn(`Link sync failed for order=${orderId}: ${(err as Error).message}`);
      }
    }

    // 2) Direct checkout order (track-order "Pay" button)
    if (doc.razorpayOrderId) {
      try {
        const res: any = await this.razorpay.orders.fetchPayments(doc.razorpayOrderId);
        const captured = (res?.items || []).find((p: any) => p.status === 'captured');
        if (captured) await this.markPaid(orderId, captured.id, Number(captured.amount) / 100);
      } catch (err) {
        this.logger.warn(`Order sync failed for order=${orderId}: ${(err as Error).message}`);
      }
    }

    return this.orders.findOne({ _id } as any);
  }

  // ─── Webhook (server-to-server, source of truth) ───────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
      throw new UnauthorizedException('Webhook not configured');
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody ?? Buffer.alloc(0)).digest('hex');
    // Guard the length first: crypto.timingSafeEqual THROWS on unequal-length
    // buffers, so a malformed/forged header would otherwise surface as a 500.
    const sig = String(signature ?? '');
    const ok = sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) {
      this.logger.warn('Razorpay webhook signature mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    this.logger.log(`Webhook received: ${event.event}`);

    const payment = event.payload?.payment?.entity;
    const link = event.payload?.payment_link?.entity;

    let orderId: string | undefined;
    let paymentId: string | undefined;
    let amountRupees = 0;

    if (event.event === 'payment.captured') {
      orderId = payment?.notes?.orderId;
      paymentId = payment?.id;
      amountRupees = payment?.amount ? Number(payment.amount) / 100 : 0;
    } else if (event.event === 'payment_link.paid') {
      // payment-link settlements carry the order id in the link's notes
      orderId = link?.notes?.orderId || payment?.notes?.orderId;
      paymentId = payment?.id || link?.id;
      amountRupees = (payment?.amount ?? link?.amount_paid ?? link?.amount ?? 0) / 100;
    } else {
      return; // ignore other events
    }

    if (!orderId || !paymentId) {
      this.logger.warn(`${event.event} missing fields: ${JSON.stringify({ orderId, paymentId })}`);
      return;
    }
    await this.markPaid(orderId, paymentId, amountRupees);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Idempotently record a captured payment against a CaterKart order. */
  private async markPaid(orderId: string, paymentId: string, amountRupees: number): Promise<any> {
    const _id = toObjectId(orderId);
    const doc = await this.orders.findOne({ _id } as any);
    if (!doc) throw new NotFoundException('Order not found');

    const processed: string[] = Array.isArray(doc.paidPaymentIds) ? doc.paidPaymentIds : [];
    if (processed.includes(paymentId)) {
      this.logger.log(`Payment ${paymentId} already recorded for order=${orderId}`);
      return doc;
    }

    const total = this.orderTotal(doc);
    const paidAmount = Math.round(Number(doc.paidAmount || 0) + Number(amountRupees || 0));
    const fullyPaid = paidAmount >= total && total > 0;
    const paymentStatus = fullyPaid ? 'paid' : 'partial';

    const set: Record<string, any> = {
      paidAmount,
      paymentStatus,
      razorpayPaymentId: paymentId,
      paidAt: new Date(),
    };
    // reflect on the order's display status so admin/track screens update
    if (fullyPaid) set.status = 'payment done';
    else if (paidAmount > 0) set.status = 'advance paid';

    await this.orders.updateOne(
      { _id } as any,
      { $set: set, $addToSet: { paidPaymentIds: paymentId } },
    );
    this.logger.log(`Order ${orderId} payment recorded: +₹${amountRupees} (paid ₹${paidAmount}/${total}, ${paymentStatus})`);
    return this.orders.findOne({ _id } as any);
  }

  /**
   * Server-authoritative pricing for an order. Recomputed from the order's
   * line-item components — NEVER the client-supplied `finalPrice` — so a
   * tampered checkout can't lower what we charge. Falls back to the stored
   * snapshot, then (for legacy orders) to the client total.
   */
  private serverPricing(doc: any): { total: number; advance: number } {
    // 1) Stored snapshot — written by OrdersService on create (from tamper-proof
    //    components) and on staff update (admin's confirmed total). Authoritative.
    const snap = doc?.serverPricing;
    if (snap && Number(snap.total) > 0) {
      return { total: Math.round(Number(snap.total)), advance: Math.round(Number(snap.advance) || 0) };
    }
    // 2) Recompute live from the order's components (covers orders saved before
    //    the snapshot existed but with a valid component breakdown).
    const live = this.pricing.computeOrderPricing(doc?.order || {});
    if (live.total > 0) return { total: live.total, advance: live.advance };
    // 3) Legacy fallback: orders created before server pricing existed at all.
    const num = doc?.order?.price?._numeric || {};
    const total = Math.round(Number(num.finalPrice) || 0);
    const advancePct = Math.min(100, Math.max(0, Number(doc?.order?.advancePercent ?? 50) || 0));
    return { total, advance: Math.round((total * advancePct) / 100) };
  }

  /** Order grand total (GST-inclusive) in rupees. */
  private orderTotal(doc: any): number {
    return this.serverPricing(doc).total;
  }

  /** Amount to charge for a given payment kind, in rupees. */
  private amountFor(doc: any, kind: string): number {
    const { total, advance } = this.serverPricing(doc);
    const paid = Number(doc?.paidAmount || 0);
    if (kind === 'advance') return Math.max(0, advance - paid);
    return Math.max(0, total - paid); // balance / full / default = outstanding
  }

  private currency(): string {
    return this.config.get<string>('RAZORPAY_CURRENCY') || 'INR';
  }

  private toPaise(rupees: number): number {
    return Math.max(100, Math.round(Number(rupees) * 100));
  }

  /**
   * Razorpay SDK throws plain objects (not Error instances) on API errors:
   *   { statusCode, error: { code, description } }
   * Convert them into proper Errors so they bubble through NestJS correctly.
   */
  private async rzpCall<T>(call: Promise<T>): Promise<T> {
    try {
      return await call;
    } catch (thrown: unknown) {
      if (thrown instanceof Error) throw thrown;
      const rzpErr = thrown as any;
      const description = rzpErr?.error?.description || rzpErr?.description || JSON.stringify(thrown);
      const statusCode = rzpErr?.statusCode ?? 500;
      throw Object.assign(new Error(`Razorpay: ${description}`), { statusCode });
    }
  }
}
