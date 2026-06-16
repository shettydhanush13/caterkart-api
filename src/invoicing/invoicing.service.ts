// src/invoicing/invoicing.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { InvoiceCounterDocument, InvoiceCounterModelName } from './invoice-counter.schema';

export type InvoiceType = 'ORD' | 'SUB' | 'COM' | 'PAY';

@Injectable()
export class InvoicingService {
  constructor(
    @InjectModel(InvoiceCounterModelName)
    private readonly counter: Model<InvoiceCounterDocument>,
  ) {}

  // Financial year (Apr–Mar) label, e.g. "25-26".
  fy(dateStr?: string): string {
    const d = dateStr ? new Date(dateStr) : new Date();
    const valid = !isNaN(d.getTime()) ? d : new Date();
    const y = valid.getFullYear();
    const start = valid.getMonth() >= 3 ? y : y - 1; // Apr = month index 3
    return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
  }

  // Atomically increment and return the next sequence for a series key.
  async next(seriesKey: string): Promise<number> {
    const doc = await (this.counter as any)
      .findOneAndUpdate(
        { key: seriesKey },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
    return doc.seq as number;
  }

  // Allocate a formatted, sequential number for a document type + date.
  //   CK/<FY>/<TYPE>-<00001>   e.g. CK/25-26/ORD-00001
  async allocate(type: InvoiceType, dateStr?: string): Promise<string> {
    const fy = this.fy(dateStr);
    const seq = await this.next(`${type}:${fy}`);
    return `CK/${fy}/${type}-${String(seq).padStart(5, '0')}`;
  }
}
