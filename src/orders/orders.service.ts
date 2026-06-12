// src/orders/orders.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { OrdersDocument, OrdersModelName } from './orders.schema';

const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'manager',
  'remarks',
  'vendors',
  'payments',
  'date',
  'order',
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(OrdersModelName) private readonly orderModel: Model<OrdersDocument>,
  ) {}

  async create(order: any): Promise<any> {
    try {
      if (!order || typeof order !== 'object') {
        throw new BadRequestException('Invalid order payload');
      }

      const vendorTemplate = () => ({
        vendor: null,
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      });

      const vendors: Record<string, any> = { caterer: vendorTemplate() };

      if (Array.isArray(order?.services)) {
        order.services.forEach((service: any, idx: number) => {
          const key =
            typeof service?.title === 'string' && service.title.trim()
              ? service.title
              : `service_${idx + 1}`;
          vendors[key] = vendorTemplate();
        });
      }

      const payments = {
        finalPayment: 0,
        vendorPayout: 0,
        taxes: 0,
        PAT: 0,
      };

      const docToCreate: Record<string, any> = {
        vendors,
        payments,
        order,
        date: order.date,
      };

      const createdDoc = await this.orderModel.create(docToCreate as any);
      const plain =
        typeof (createdDoc as any).toObject === 'function'
          ? (createdDoc as any).toObject()
          : createdDoc;

      this.logger.debug(`Order saved: ${plain?._id ?? '[no-id]'}`);
      return plain;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to store order', err);
      throw new InternalServerErrorException('Failed to store order');
    }
  }

  async findAll(opts: { page?: number; limit?: number; status?: string } = {}): Promise<{
    data: any[];
    page: number;
    limit: number;
    total: number;
  }> {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));
    const filter: Record<string, any> = {};
    if (opts.status && typeof opts.status === 'string') {
      filter.status = opts.status;
    }

    try {
      const [data, total] = await Promise.all([
        (this.orderModel as any)
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec() as Promise<any[]>,
        this.orderModel.countDocuments(filter).exec(),
      ]);
      return { data: data as any[], page, limit, total };
    } catch (err) {
      this.logger.error('Failed to fetch all orders', err);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  async findById(id: string): Promise<any | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    try {
      return await (this.orderModel as any).findById(id).lean().exec();
    } catch (err) {
      this.logger.error(`Failed to fetch order by id ${id}`, err);
      throw new InternalServerErrorException('Failed to fetch order');
    }
  }

  /** Orders whose customer phone matches the given number (last 10 digits). */
  async findByPhone(phone: string): Promise<any[]> {
    const digits = String(phone || '').replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length !== 10) {
      throw new BadRequestException('A valid 10-digit phone number is required');
    }
    try {
      const re = new RegExp(`${last10}$`);
      const docs = await (this.orderModel as any)
        .find({
          $or: [
            { 'order.customerData.phone': re },
            { 'order.customer.phone': re },
            { 'customerData.phone': re },
          ],
        })
        .sort({ createdAt: -1, _id: -1 })
        .lean()
        .exec();
      return docs || [];
    } catch (err) {
      this.logger.error(`Failed to fetch orders for phone`, err);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  async update(id: string, body: any): Promise<any | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid payload for update');
    }

    // Whitelist allowed fields to prevent mass-assignment.
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(k)) sanitized[k] = v;
    }

    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException('No updatable fields in payload');
    }

    try {
      // Atomic: single op, no read-then-write race.
      const updated = await (this.orderModel as any)
        .findByIdAndUpdate(id, { $set: sanitized }, { new: true, runValidators: true })
        .lean()
        .exec();

      if (!updated) {
        throw new NotFoundException(`Order with id ${id} not found`);
      }

      this.logger.debug(`Order updated: ${id}`);
      return updated;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Failed to update order', err);
      throw new InternalServerErrorException('Failed to update order');
    }
  }
}
