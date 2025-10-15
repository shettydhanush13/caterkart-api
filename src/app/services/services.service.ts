import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

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
}
