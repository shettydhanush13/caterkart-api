import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

// Strip any keys starting with "$" or containing "." to prevent NoSQL
// operator/path injection when mixing user-provided objects into $set.
function sanitizeForSet(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForSet);
  if (typeof obj !== 'object') return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k !== 'string') continue;
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = sanitizeForSet(v);
  }
  return out;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private normalizeEventForSearch(event: string): string {
    if (!event) return event;
    const lower = event.toLowerCase();
    if (lower.includes('birthday')) return 'Birthday';
    if (lower.includes('wedding')) return 'Wedding';
    if (lower.includes('anniversary')) return 'Anniversary';
    return event;
  }

  private async findOptionsFromCollection(
    collectionName: string,
    searchEvent: string,
  ): Promise<any[]> {
    try {
      const coll = this.connection.collection(collectionName);
      if (!coll) return [];
      const docs = await coll.find({ events: searchEvent }).toArray();
      return docs;
    } catch (err) {
      this.logger.error(`DB query failed for ${collectionName}`, err);
      return [];
    }
  }

  /** Helper to read numeric price from a document in flexible schema shapes */
  private extractNumericPrice(doc: any): number | null {
    if (!doc) return null;
    if (typeof doc.price === 'number') return doc.price;
    if (doc.price && typeof doc.price === 'object') {
      if (typeof doc.price.min === 'number') return doc.price.min;
      if (typeof doc.price.value === 'number') return doc.price.value;
    }
    if (typeof doc.minPrice === 'number') return doc.minPrice;
    if (typeof doc.price_inr === 'number') return doc.price_inr;
    return null;
  }

  private humanizeType(type: string): string {
    if (!type) return '';
    return type
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Build groups grouped by `typeLabel` (fallback to `type`).
   * Each group => { title, price: { min }, image, multiple, subOptions: [...] }
   */
  private buildGroupsByTypeLabel(docs: any[]): any[] {
    const groupsMap = new Map<string, any[]>();

    for (const d of docs) {
      // use typeLabel first, then type, then 'others'
      const typeKey = (d.typeLabel || d.type || 'others').toString();
      if (!groupsMap.has(typeKey)) groupsMap.set(typeKey, []);
      groupsMap.get(typeKey)!.push(d);
    }

    const groups: any[] = [];

    for (const [typeKey, items] of groupsMap.entries()) {
      // compute min/max price from the items
      const prices: number[] = items
        .map((it) => this.extractNumericPrice(it))
        .filter((p): p is number => typeof p === 'number');

      const min = prices.length ? Math.min(...prices) : null;

      const first = items[0] || {};
      // image priority: imgs[0] -> images[0] -> image -> photo -> null
      const image =
        (Array.isArray(first.imgs) && first.imgs[0]) ||
        (Array.isArray(first.images) && first.images[0]) ||
        first.image ||
        first.photo ||
        null;

      // determine multiple: prefer explicit allowMultiple / multiple on group items
      const multiple =
        items.some((it) => it.allowMultiple === true || it.multiple === true) || false;

      groups.push({
        title: this.humanizeType(typeKey),
        price: {
          min: min ?? 0,
        },
        image,
        multiple,
        subOptions: items,
      });
    }

    groups.sort((a, b) => a.title.localeCompare(b.title));
    return groups;
  }

  async getServicesByEvent(event: string): Promise<any> {
    try {
      const searchEvent = this.normalizeEventForSearch(event);

      const celebrationStepsMap: Record<string, any[]> = {
        'Birthday Party': [
          {
            icon: '🪅',
            color: 'pink-icon',
            type: 'decorations',
            text: 'Decor Your Way – Props, Fun & Games!',
            options: [],
          },
          {
            icon: '🧑‍🍳',
            color: 'pink-icon',
            type: 'live-stations',
            text: 'Add Live Stations – Fresh & Fun!',
            options: [],
          },
          {
            icon: '🎭',
            color: 'pink-icon',
            type: 'artists',
            text: 'Spice It Up – Artists & Entertainment!',
            options: [],
          },
        ],
      };

      const steps =
        celebrationStepsMap[event] ??
        [
          {
            icon: '🎉',
            color: 'default-icon',
            type: 'decorations',
            text: 'Decorations',
            options: [],
          },
          {
            icon: '🍽️',
            color: 'default-icon',
            type: 'live-stations',
            text: 'Live Stations',
            options: [],
          },
          {
            icon: '🎤',
            color: 'default-icon',
            type: 'artists',
            text: 'Artists & Entertainment',
            options: [],
          },
        ];

      for (const step of steps) {
        let collectionName = '';
        switch (step.type) {
          case 'live-stations':
            collectionName = 'LiveStations';
            break;
          case 'artists':
            collectionName = 'Artists';
            break;
          case 'decorations':
            collectionName = 'Decorations';
            break;
          default:
            collectionName = '';
        }

        if (!collectionName) {
          step.options = [];
          continue;
        }

        const docs = await this.findOptionsFromCollection(collectionName, searchEvent);

        // Use grouping by typeLabel for decorations and artists
        if (step.type === 'decorations' || step.type === 'artists') {
          step.options = this.buildGroupsByTypeLabel(docs);
        } else {
          // live-stations: keep as-is but mapped to lightweight shape
          step.options = docs;
        }
      }

      // filter out any step that has no options (empty array or falsy)
      const visibleSteps = steps.filter(
        (s) => Array.isArray(s.options) && s.options.length > 0,
      );

      return visibleSteps;
    } catch (err) {
      this.logger.error('Failed to get formatted service steps', err);
      throw new InternalServerErrorException('Failed to get formatted service steps');
    }
  }

  async getInventory(category: string): Promise<any[]> {
    try {
      if (!category) return [];

      const key = String(category).toLowerCase().trim();

      let collectionName = '';
      if (['decoration', 'decorations', 'decor'].includes(key)) {
        collectionName = 'Decorations';
      } else if (['artist', 'artists'].includes(key)) {
        collectionName = 'Artists';
      } else if (['live-station', 'live-stations', 'livestation', 'livestations', 'live stations', 'live-station'].includes(key)) {
        collectionName = 'LiveStations';
      } else {
        // unknown category -> return empty array (caller can decide)
        this.logger.warn(`getInventory called with unknown category: ${category}`);
        return [];
      }

      const coll = this.connection.collection(collectionName);
      const docs = await coll.find({}).toArray();
      return docs;
    } catch (err) {
      this.logger.error(`Failed to fetch inventory for category=${category}`, err);
      throw new InternalServerErrorException('Failed to fetch inventory');
    }
  }

  /**
   * Map the incoming category string to the MongoDB collection name
   */
  private mapCategoryToCollection(category: string): string | null {
    const key = String(category || '').toLowerCase().trim();
    if (['decoration', 'decorations', 'decor'].includes(key)) return 'Decorations';
    if (['artist', 'artists'].includes(key)) return 'Artists';
    if (['live-station', 'live-stations', 'livestation', 'livestations', 'live stations', 'live-station'].includes(key)) return 'LiveStations';
    return null;
  }

  /**
   * Update inventory item by category and id.
   * - category: used to determine collection
   * - id: document _id (string or ObjectId hex)
   * - item: object with fields to be set on the document (may include _id)
   *
   * Returns the updated document or null if not found.
   */
  async updateInventory(category: string, id: string, item: any): Promise<any> {
    try {
      const collectionName = this.mapCategoryToCollection(category);
      if (!collectionName) {
        this.logger.warn(`updateInventory called with unknown category: ${category}`);
        throw new NotFoundException('Unknown category');
      }

      const coll = this.connection.collection(collectionName);
      if (!coll) {
        this.logger.error(`Collection not available: ${collectionName}`);
        throw new InternalServerErrorException('Collection not available');
      }

      // prepare identifier: try ObjectId if looks like a 24-char hex, else use raw string
      let queryId: any = id;
      if (typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id)) {
        try {
          queryId = new Types.ObjectId(id);
        } catch (e) {
          queryId = id;
        }
      }

      // Clone and sanitize the incoming payload: strip $-prefixed and
      // dotted keys to prevent NoSQL injection, and drop _id.
      const payload = sanitizeForSet({ ...item });
      if (payload._id) delete payload._id;

      // Convert vendor.serviceableArea mapping -> array if needed
      if (payload.vendor?.serviceableArea && typeof payload.vendor.serviceableArea === 'object' && !Array.isArray(payload.vendor.serviceableArea)) {
        payload.vendor.serviceableArea = Object.entries(payload.vendor.serviceableArea)
          .filter(([, val]) => !!val)
          .map(([k]) => k);
      }

      // Set updatedAt if not present
      payload.updatedAt = new Date().toISOString();

      // Build filter as any to satisfy TypeScript mongodb typings
      const filter: any = { _id: queryId };

      // Execute update
      const result = await coll.updateOne(filter, { $set: payload });

      if (result.matchedCount === 0) {
        // If no match found, attempt to match by string id (some collections store _id as string)
        const altFilter: any = { _id: id };
        const altResult = await coll.updateOne(altFilter, { $set: payload });
        if (altResult.matchedCount === 0) {
          this.logger.warn(`No document found to update in ${collectionName} for id=${id}`);
          return null;
        }
      }

      // Return the fresh document (try ObjectId-based filter first, then string-based filter)
      let updated: any = await coll.findOne(filter as any);
      if (!updated) updated = await coll.findOne({ _id: id } as any);

      return updated;
    } catch (err) {
      this.logger.error(`Failed to update inventory for category=${category} id=${id}`, err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to update inventory');
    }
  }
}
