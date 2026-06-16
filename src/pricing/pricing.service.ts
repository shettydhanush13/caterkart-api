import { Injectable } from '@nestjs/common';

/**
 * Server-authoritative pricing. Mirrors the frontend single source of truth
 * (mealmate/src/services/pricing.js) so the amount a customer is charged is
 * recomputed on the server from the order's own line-item components — never
 * trusted from a client-supplied grand total.
 *
 * Tax model: GST 5% on the (food + service) taxable base; platform & delivery
 * fees are ₹0. The admin's negotiated discount is applied to the GST-inclusive
 * total (matching how the order is persisted). The advance percent is clamped
 * to a sane range.
 */
export const GST_RATE = 5;
export const PLATFORM_FEE = 0;
export const DELIVERY_FEE = 0;
export const ADVANCE_PCT = 50;

export interface OrderPricing {
  foodNet: number;
  serviceNet: number;
  taxableBase: number;
  gst: number;
  platformFee: number;
  deliveryFee: number;
  adminDiscount: number;
  total: number; // GST-inclusive amount the customer owes
  advancePct: number;
  advance: number;
  computedAt: string;
}

const r = (n: any): number => Math.round(Number(n) || 0);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

@Injectable()
export class PricingService {
  gstOn(taxable: number): number {
    return Math.round(((Number(taxable) || 0) * GST_RATE) / 100);
  }

  /**
   * Recompute the authoritative pricing for an order from its `price._numeric`
   * component breakdown + adminDiscount + advancePercent. The grand total is
   * derived here (not read from the client's `finalPrice`), so tampering with
   * the aggregate total or the GST line has no effect.
   *
   * `trustFinal` is set ONLY on staff-authenticated updates: a logged-in admin
   * may edit line items (which can leave the component fields stale while the
   * recomputed `finalPrice` stays correct), so we honour their confirmed total.
   * It is never set on the customer create path, where the components are the
   * tamper-proof source of truth.
   */
  computeOrderPricing(order: any, opts: { trustFinal?: boolean } = {}): OrderPricing {
    const num = order?.price?._numeric || {};

    const foodTotal = r(num.totalFoodPrice);
    const foodDiscount = r(num.foodDiscount); // already includes carrier saving
    const serviceCharge = r(num.serviceCharge);
    const serviceDiscount = r(num.serviceDiscount);

    const foodNet = Math.max(0, foodTotal - foodDiscount);
    const serviceNet = Math.max(0, serviceCharge - serviceDiscount);
    const taxableBase = foodNet + serviceNet;

    const gst = Math.round((taxableBase * GST_RATE) / 100);
    const liveTotal = taxableBase + PLATFORM_FEE + DELIVERY_FEE + gst;

    const adminDiscount = Math.max(0, r(order?.adminDiscount));
    let total = Math.max(0, liveTotal - adminDiscount);

    // On a trusted staff edit, the admin's recomputed finalPrice wins (it already
    // nets out the negotiated discount and reflects any item edits).
    if (opts.trustFinal) {
      const finalPrice = r(num.finalPrice);
      if (finalPrice > 0) total = finalPrice;
    }

    const advancePct = clamp(
      Number(order?.advancePercent ?? ADVANCE_PCT) || 0,
      0,
      100,
    );
    const advance = Math.round((total * advancePct) / 100);

    return {
      foodNet,
      serviceNet,
      taxableBase,
      gst,
      platformFee: PLATFORM_FEE,
      deliveryFee: DELIVERY_FEE,
      adminDiscount,
      total,
      advancePct,
      advance,
      computedAt: new Date().toISOString(),
    };
  }
}
