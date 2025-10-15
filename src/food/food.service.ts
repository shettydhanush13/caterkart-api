import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

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
      if (area) query[`service.${area}`] = true;

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

        if (!menuItems[sub]) menuItems[sub] = {};
        menuItems[sub][label] = { name: label, desc, veg, id, price };

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
}
