// src/orders/schemas/orders.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type OrdersDocument = Orders & Document;

/**
 * Store documents in this shape:
 * {
 *   status: string,
 *   manager: string,
 *   vendors: Map<{ vendor?: any, finalPayment: number, vendorPayout: number, taxes: number, PAT: number }>,
 *   payments: { finalPayment, vendorPayout, taxes, PAT },
 *   order: <raw incoming order object>,            // source of truth for services
 *   createdDate: Date,
 *   createdAt, updatedAt, _id...
 * }
 *
 * strict:false & minimize:false keep flexibility for `order` nested structure.
 */
@Schema({
  collection: 'Orders',
  timestamps: true,
  strict: false,
  minimize: false,
})
export class Orders {
  @Prop({ type: String, required: true, default: 'new', index: true })
  status: string;

  @Prop({ type: String, required: true, default: 'dhanush' })
  manager: string;

  @Prop({ type: String, required: false, default: '' })
  remarks?: string;

  @Prop({ type: String, required: true })
  date: string;

  /**
   * vendors is a Map keyed by:
   *  - "caterer" (for the caterer)
   *  - each service id or service title fallback key
   *
   * Each value has the shape:
   * {
   *   vendor: any (e.g. vendor id/object) | null,
   *   finalPayment: number,
   *   vendorPayout: number,
   *   taxes: number,
   *   PAT: number
   * }
   */
  @Prop({
    type: SchemaTypes.Map,
    of: {
      vendor: { type: SchemaTypes.Mixed, required: false, default: null },
      finalPayment: { type: Number, required: true, default: 0 },
      vendorPayout: { type: Number, required: true, default: 0 },
      taxes: { type: Number, required: true, default: 0 },
      PAT: { type: Number, required: true, default: 0 },
    },
    required: false,
    default: () => ({}),
  })
  vendors?: Map<
    string,
    {
      vendor?: any;
      finalPayment: number;
      vendorPayout: number;
      taxes: number;
      PAT: number;
    }
  >;

  // Sequential GST invoice numbers, assigned once by the server (never client-set).
  @Prop({ type: String, required: false, index: true })
  invoiceNo?: string;        // customer food tax invoice (series ORD)

  @Prop({ type: String, required: false, index: true })
  commissionInvoiceNo?: string; // vendor commission tax invoice (series COM)

  @Prop({ type: String, required: false, index: true })
  payoutNo?: string;         // vendor payout statement (series PAY)

  // store the incoming request body exactly here (source of truth)
  @Prop({ type: SchemaTypes.Mixed, required: true })
  order: any;
}

export const OrdersSchema = SchemaFactory.createForClass(Orders);

OrdersSchema.index({ status: 1, createdAt: -1 });
OrdersSchema.index({ manager: 1, createdAt: -1 });
OrdersSchema.index({ createdAt: -1 });
OrdersSchema.index({ date: 1 });

export const OrdersModelName = 'Orders';
