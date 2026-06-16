import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const COLLECTION = 'Reviews';

// Case-insensitive collation — vendorName equality matches use an index
// (a `$regex`/`$options:i` scan cannot).
const CI = { locale: 'en', strength: 2 } as const;

const clampRating = (r: any): number => {
  const n = Math.round(Number(r) || 0);
  return Math.min(5, Math.max(1, n));
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get coll() {
    return this.connection.collection(COLLECTION);
  }

  async list(vendorName: string, limit = 30): Promise<any[]> {
    const n = String(vendorName || '').trim();
    if (!n) return [];
    try {
      return await this.coll
        .find({ vendorName: n } as any, { collation: CI } as any)
        .sort({ createdAt: -1 })
        .limit(Math.min(100, Number(limit) || 30))
        .toArray();
    } catch (err) {
      this.logger.error('Failed to list reviews', err);
      throw new InternalServerErrorException('Failed to list reviews');
    }
  }

  // aggregate { average, count } for a vendor
  async summary(vendorName: string): Promise<{ average: number; count: number }> {
    const n = String(vendorName || '').trim();
    if (!n) return { average: 0, count: 0 };
    try {
      const rows = await this.coll
        .aggregate(
          [
            { $match: { vendorName: n } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
          ],
          { collation: CI },
        )
        .toArray();
      const r = rows[0];
      return { average: r ? Math.round(r.avg * 10) / 10 : 0, count: r ? r.count : 0 };
    } catch (err) {
      this.logger.error('Failed to summarise reviews', err);
      return { average: 0, count: 0 };
    }
  }

  async create(data: Record<string, any>): Promise<any> {
    const vendorName = String(data?.vendorName || '').trim();
    const rating = clampRating(data?.rating);
    if (!vendorName) throw new BadRequestException('vendorName is required');
    if (!rating) throw new BadRequestException('A 1–5 star rating is required');
    const doc = {
      vendorName,
      rating,
      text: String(data?.text || '').trim().slice(0, 1000),
      author: String(data?.author || 'Guest').trim().slice(0, 80) || 'Guest',
      source: 'caterkart',
      createdAt: new Date(),
    };
    try {
      const res = await this.coll.insertOne(doc as any);
      // denormalise the aggregate onto the vendor for fast reads
      const { average, count } = await this.summary(vendorName);
      await this.connection
        .collection('Vendors')
        .updateOne(
          { name: vendorName } as any,
          { $set: { ratingAverage: average, ratingCount: count } },
          { collation: CI } as any,
        );
      return { _id: res.insertedId, ...doc };
    } catch (err) {
      this.logger.error('Failed to create review', err);
      throw new InternalServerErrorException('Failed to create review');
    }
  }
}
