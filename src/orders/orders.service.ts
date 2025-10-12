// src/orders/orders.service.ts
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { OrdersDocument, OrdersModelName } from './orders.schema';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(OrdersModelName) private readonly orderModel: Model<OrdersDocument>,
  ) {}

  async create(order: any): Promise<any> {
    try {
      if (!order || typeof order !== 'object') {
        throw new InternalServerErrorException('Invalid order payload');
      }

      // Build vendors object (create fresh object per key)
      const vendors: Record<string, any> = {};
      const vendorTemplate = () => ({
        vendor: null,
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      });

      // Add caterer placeholder
      vendors['caterer'] = vendorTemplate();

      // Add service placeholders (if any)
      if (Array.isArray(order?.services)) {
        order.services.forEach((service: any, idx: number) => {
          const key = service?.title || `service_${idx + 1}`;
          vendors[key] = vendorTemplate();
        });
      }

      const payments = {
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      };

      // Build final document to insert
      const docToCreate: Record<string, any> = {
        vendors,
        payments,
        order, // keep the exact incoming order body here
        createdDate: new Date(),
      };

      const createdDoc = await this.orderModel.create(docToCreate as any);

      // Return plain JS object
      const plain =
        typeof (createdDoc as any).toObject === 'function'
          ? (createdDoc as any).toObject()
          : createdDoc;

      this.logger.debug(`Order saved: ${plain?._id ?? '[no-id]'} status=${plain?.status}`);
      return plain;
    } catch (err) {
      this.logger.error('Failed to store order', err);
      throw new InternalServerErrorException('Failed to store order');
    }
  }

  /**
   * Return all orders as plain objects.
   *
   * Note: using `as unknown as any[]` prevents TS from expanding Mongoose's complex
   * union return type (TS2590).
   */
  async findAll(): Promise<any[]> {
    try {
      const results = await this.orderModel.find().sort({ createdDate: -1 });
      return results;
    } catch (err) {
      this.logger.error('Failed to fetch all orders', err);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  /**
   * Return single order by Mongo _id (string).
   */
  async findById(id: string): Promise<any | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }
      const result = await this.orderModel.findById(id);
      return result;
    } catch (err) {
      this.logger.error(`Failed to fetch order by id ${id}`, err);
      throw new InternalServerErrorException('Failed to fetch order');
    }
  }
/**
   * Replace the stored order document with `body`.
   * - `body` is treated as the top-level document to store.
   * - we preserve timestamps handled by mongoose; returning the updated document.
   */
  async update(id: string, body: any): Promise<any> {
    try {
      if (!body || typeof body !== 'object') {
        throw new InternalServerErrorException('Invalid payload for update');
      }

      // find if exists first (optional, but lets us return NotFound cleanly)
      const exists = await (this.orderModel as any).findById(id).lean().exec();
      if (!exists) {
        // caller/controller will convert this to 404
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      // We want to fully replace the stored document with the provided body.
      // Using findByIdAndUpdate with $set to replace top-level fields.
      // NOTE: this will not remove _id or mongoose timestamps; if you truly want to replace the whole Mongo doc,
      // you'd need a delete+insert — but typically updating fields is preferred.
      const updated = await (this.orderModel as any).findByIdAndUpdate(
        id,
        { $set: body },
        { new: true, lean: true, runValidators: false }, // return the updated doc
      ).exec();

      // updated should be the fresh object
      this.logger.debug(`Order updated: ${id}`);
      return updated;
    } catch (err) {
      this.logger.error('Failed to update order', err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to update order');
    }
  }
}

