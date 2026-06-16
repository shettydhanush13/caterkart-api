// src/invoicing/invoice-counter.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InvoiceCounterDocument = InvoiceCounter & Document;

/**
 * One document per invoice series — e.g. key "ORD:25-26", "COM:25-26".
 * `seq` is bumped atomically with $inc to hand out gap-free, sequential
 * invoice numbers per financial year, as GST law expects.
 */
@Schema({ collection: 'InvoiceCounters', timestamps: true })
export class InvoiceCounter {
  @Prop({ type: String, required: true, unique: true, index: true })
  key: string;

  @Prop({ type: Number, required: true, default: 0 })
  seq: number;
}

export const InvoiceCounterSchema = SchemaFactory.createForClass(InvoiceCounter);
export const InvoiceCounterModelName = 'InvoiceCounters';
