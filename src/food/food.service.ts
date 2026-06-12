// src/food/food.service.ts
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Safe token pattern for identifiers interpolated into Mongo field paths
// (prevents NoSQL injection via dot/operator chars in dynamic keys).
const SAFE_AREA_KEY = /^[a-zA-Z0-9_-]{1,64}$/;

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

export const categories = {
  Breakfast: [
    'Idly/Vada',
    'Dosa',
    'Bath',
    'Rotti',
    'Fried Breakfast',
    'Beverages',
  ],
  Snacks: [
    'Dry Item',
    'Chinese',
    'Noodles',
    'Additional Items',
    'Extras',
  ],
  Mains: ['Breads', 'Curries', 'Rice', 'Welcome Drink'],
  Desserts: ['Sweet'],
  Sides: ['Pallya'],
  Beverages: ['Hot Drinks', 'Cold Drinks'],
  Cutlery: ['Cutlery & Service'],
};

@Injectable()
export class FoodService {
  private readonly logger = new Logger(FoodService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Try to convert a 24-char hex string to ObjectId, otherwise return original.
   * Safe for already-ObjectId values as well.
   */
  private toObjectIdIfPossible(id: any): any {
    if (!id && id !== 0) return id;

    // If already a Types.ObjectId instance
    if (id instanceof Types.ObjectId) return id;

    // If it's a string that looks like an ObjectId
    if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
      try {
        return new Types.ObjectId(id);
      } catch (e) {
        // fallback - return original string if new fails for any reason
        return id;
      }
    }

    // leave other values as-is (numbers, custom strings, etc.)
    return id;
  }

  /**
   * Fetch food items filtered by area and vegOnly
   * Format output into categories & subcategories with only populated ones.
   */
  async getAllFormatted(
    area?: string,
    vegOnly?: boolean,
  ): Promise<{ categories: Record<string, string[]>; menuItems: any }> {
    try {
      const db = this.connection.db;
      const collection = db.collection('Food');

      // Base query
      const query: Record<string, any> = { active: true };
      if (area) {
        if (!SAFE_AREA_KEY.test(area)) {
          throw new BadRequestException('Invalid area');
        }
        // Availability now derives from the vendor: an item is available in an
        // area if one of its vendors services that area. Legacy items still use
        // the item-level service map as a fallback.
        const vendorNames = (
          await db
            .collection('Vendors')
            .find({ serviceAreas: area }, { projection: { name: 1 } })
            .toArray()
        )
          .map((v) => v.name)
          .filter(Boolean);
        query.$or = [{ [`service.${area}`]: true }];
        if (vendorNames.length) {
          query.$or.push({ 'vendors.vendor': { $in: vendorNames } });
        }
      }

      // Only filter veg if explicitly true
      if (vegOnly === true) {
        query.veg = true;
      }

      // Fetch only required fields
      const projection = {
        _id: 0,
        name: 1,
        itemName: 1,
        desc: 1,
        category: 1,
        subcategory: 1,
        veg: 1,
        price: 1,
        quantity: 1,
        vendors: 1,
      };

      const docs = await collection
        .find(query, { projection })
        .sort({ category: 1, subcategory: 1, itemName: 1, name: 1 })
        .toArray();

      if (!docs.length) {
        return { categories: {}, menuItems: {} };
      }

      // Format into structured object
      const menuItems: Record<string, Record<string, any>> = {};
      const categoryTracker: Record<string, Set<string>> = {};

      for (const doc of docs) {
        const cat = doc.category;
        const sub = doc.subcategory;
        if (!cat || !sub) continue;

        const label = doc.itemName || doc.name || '';
        const desc = doc.desc || doc.quantity || '';
        const price = Number(doc.price) || 0;
        const veg = doc.veg === true;
        const id = uuidv4();

        const vendors = Array.isArray(doc.vendors)
          ? doc.vendors
              .map((v: any) => ({ vendor: String(v?.vendor || '').trim(), price: Number(v?.price) || 0 }))
              .filter((v: any) => v.vendor)
          : [];

        if (!menuItems[sub]) menuItems[sub] = {};
        menuItems[sub][label] = { name: label, desc, veg, id, price, vendors };

        // Track categories that have data
        if (!categoryTracker[cat]) categoryTracker[cat] = new Set();
        categoryTracker[cat].add(sub);
      }

      // ✅ Include only categories/subcategories that actually have data
      const filteredCategories: Record<string, string[]> = {};
      for (const cat of Object.keys(categories)) {
        const validSubs = categories[cat].filter(
          (sub) => categoryTracker[cat]?.has(sub),
        );
        if (validSubs.length > 0) filteredCategories[cat] = validSubs;
      }

      return { categories: filteredCategories, menuItems };
    } catch (err) {
      this.logger.error('Failed to get formatted food list', err);
      throw new InternalServerErrorException('Failed to get formatted food list');
    }
  }

  async getFoodInventory(): Promise<any> {
    const db = this.connection.db;
    const collection = db.collection('Food');

    const docs = await collection
      .find({}, {})
      .sort({ category: 1, subcategory: 1, itemName: 1, name: 1 })
      .toArray();

    return docs;
  }

  async getFoodInventoryList(area?: string): Promise<Record<string, Record<string, Array<{ _id: any; itemName?: string; price?: number }>>>> {
    try {
      const db = this.connection.db;
      const collection = db.collection('Food');
  
      // Build query: if area provided, require service.<area> === true
      const query: Record<string, any> = {};
      if (area && typeof area === 'string' && area.trim()) {
        if (!SAFE_AREA_KEY.test(area)) {
          throw new BadRequestException('Invalid area');
        }
        query[`service.${area}`] = true;
      }
  
      // Only fetch fields we need + category/subcategory for grouping
      const projection = {
        _id: 1,
        itemName: 1,
        price: 1,
        category: 1,
        subcategory: 1,
      };
  
      const docs = await collection
        .find(query, { projection })
        .sort({ category: 1, subcategory: 1, itemName: 1, name: 1 })
        .toArray();
  
      // Group by category -> subcategory
      const grouped: Record<string, Record<string, Array<{ _id: any; itemName?: string; price?: number }>>> = {};
  
      for (const d of docs) {
        const cat = (d.category && String(d.category)) || 'Uncategorized';
        const sub = (d.subcategory && String(d.subcategory)) || 'Other';
  
        if (!grouped[cat]) grouped[cat] = {};
        if (!grouped[cat][sub]) grouped[cat][sub] = [];
  
        grouped[cat][sub].push({
          _id: d._id,
          itemName: d.itemName,
          price: d.price,
        });
      }
  
      return grouped;
    } catch (err) {
      this.logger.error('Failed to fetch filtered & grouped food inventory', err);
      throw err;
    }
  }  

/**
 * Update a single item by id.
 * - id: _id value (string or ObjectId-like)
 * - patch: partial object of fields to update (fields with value === undefined are ignored)
 * Returns: the updated document, or null if not found.
 */
async updateOneById(id: any, patch: Record<string, any>): Promise<any> {
  try {
    if (id === undefined || id === null) return null;

    const db = this.connection.db;
    const collection = db.collection('Food');

    const actualId = this.toObjectIdIfPossible(id);

    // Sanitize patch: drop $-keys and dotted keys, remove _id and undefined values.
    const sanitized = sanitizeForSet(patch || {});
    const updateFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(sanitized)) {
      if (k === '_id') continue;
      if (v !== undefined) updateFields[k] = v;
    }
    updateFields.updatedAt = new Date();

    const filterCandidates: any[] = [];
    if (actualId !== undefined && actualId !== null) filterCandidates.push(actualId);
    filterCandidates.push(id);
    const uniqueFilters = Array.from(new Map(filterCandidates.map(x => [String(x), x])).values());
    const filter = uniqueFilters.length === 1 ? { _id: uniqueFilters[0] } : { _id: { $in: uniqueFilters } };

    // The MongoDB node driver v5+ returns the document directly (not { value }).
    // Handle both shapes defensively.
    const result: any = await collection.findOneAndUpdate(
      filter,
      { $set: updateFields },
      { returnDocument: 'after', upsert: false },
    );

    if (!result) return null;
    if (typeof result === 'object' && 'value' in result) {
      return (result as any).value ?? null;
    }
    return result;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    this.logger.error('Failed to update food item', err);
    throw new InternalServerErrorException('Failed to update food item');
  }
}


}
