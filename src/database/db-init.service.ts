import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

// Case-insensitive collation — lets equality lookups on names use an index
// (a `$regex` with `$options: 'i'` cannot).
const CI = { locale: 'en', strength: 2 } as const;

type IndexSpec = {
  collection: string;
  keys: Record<string, 1 | -1>;
  options?: Record<string, any>;
};

// Declarative index catalogue. createIndex is idempotent: an index that already
// exists with the same definition is a no-op, so this is safe to run every boot.
const INDEXES: IndexSpec[] = [
  // --- Food: menu reads filter on active + vendor/category, serviceability via vendor ---
  { collection: 'Food', keys: { active: 1, vendor: 1 }, options: { name: 'active_vendor' } },
  { collection: 'Food', keys: { active: 1, category: 1, subcategory: 1 }, options: { name: 'active_cat_subcat' } },
  { collection: 'Food', keys: { 'vendors.vendor': 1 }, options: { name: 'legacy_vendors_vendor', sparse: true } },

  // --- Vendors: name lookups (collation) + area/active coverage ---
  { collection: 'Vendors', keys: { name: 1 }, options: { name: 'name_ci', collation: CI } },
  { collection: 'Vendors', keys: { serviceAreas: 1, active: 1 }, options: { name: 'serviceAreas_active' } },

  // --- Pincodes: exact lookup on the inline-serviceability hot path ---
  { collection: 'Pincodes', keys: { pincode: 1 }, options: { name: 'uniq_pincode', unique: true } },
  { collection: 'Pincodes', keys: { area: 1, pincode: 1 }, options: { name: 'area_pincode' } },

  // --- Admins: every login resolves a role by phone ---
  { collection: 'Admins', keys: { phone: 1 }, options: { name: 'uniq_phone', unique: true } },

  // --- Reviews: list + aggregate by vendor (collation) ---
  { collection: 'Reviews', keys: { vendorName: 1, createdAt: -1 }, options: { name: 'vendor_createdAt_ci', collation: CI } },

  // --- Combos: filtered by meal slot / box type / vendor ---
  { collection: 'Combos', keys: { mealSlots: 1 }, options: { name: 'mealSlots' } },
  { collection: 'Combos', keys: { boxType: 1 }, options: { name: 'boxType' } },
  { collection: 'Combos', keys: { vendor: 1 }, options: { name: 'vendor' } },

  // --- Orders: server-side idempotency for POST /order (partial: only keyed docs) ---
  {
    collection: 'Orders',
    keys: { idempotencyKey: 1 },
    options: {
      name: 'uniq_idempotencyKey',
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    },
  },
  // unique invoice numbers, only on orders that have them assigned
  {
    collection: 'Orders',
    keys: { invoiceNo: 1 },
    options: {
      name: 'uniq_invoiceNo',
      unique: true,
      partialFilterExpression: { invoiceNo: { $type: 'string' } },
    },
  },
  {
    collection: 'Orders',
    keys: { commissionInvoiceNo: 1 },
    options: {
      name: 'uniq_commissionInvoiceNo',
      unique: true,
      partialFilterExpression: { commissionInvoiceNo: { $type: 'string' } },
    },
  },
  {
    collection: 'Orders',
    keys: { payoutNo: 1 },
    options: {
      name: 'uniq_payoutNo',
      unique: true,
      partialFilterExpression: { payoutNo: { $type: 'string' } },
    },
  },

  // --- Invoice counters: one doc per series, atomic $inc for sequential numbers ---
  { collection: 'InvoiceCounters', keys: { key: 1 }, options: { name: 'uniq_counter_key', unique: true } },

  // --- Subscriptions: admin list by status/recency + idempotent create ---
  { collection: 'Subscriptions', keys: { status: 1, createdAt: -1 }, options: { name: 'status_createdAt' } },
  { collection: 'Subscriptions', keys: { phone: 1 }, options: { name: 'phone' } },
  {
    collection: 'Subscriptions',
    keys: { idempotencyKey: 1 },
    options: {
      name: 'uniq_idempotencyKey',
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    },
  },

  // --- Celebration add-on catalogues: queried by event ---
  { collection: 'Decorations', keys: { events: 1 }, options: { name: 'events' } },
  { collection: 'Artists', keys: { events: 1 }, options: { name: 'events' } },
  { collection: 'LiveStations', keys: { events: 1 }, options: { name: 'events' } },
];

@Injectable()
export class DbInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbInitService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  // Runs after every module has initialised (and the Mongoose connection is up).
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.connection.asPromise(); // ensure the socket is connected
    } catch (err) {
      this.logger.error('DB connection not ready; skipping index ensure', err);
      return;
    }

    const db = this.connection.db;
    if (!db) {
      this.logger.error('DB handle unavailable; skipping index ensure');
      return;
    }
    let created = 0;
    for (const spec of INDEXES) {
      try {
        await db.collection(spec.collection).createIndex(spec.keys as any, spec.options || {});
        created++;
      } catch (err: any) {
        // A unique index can fail if legacy data already holds duplicates — log
        // and continue so one bad collection never blocks startup.
        this.logger.warn(
          `Index ${spec.options?.name || JSON.stringify(spec.keys)} on ${spec.collection} skipped: ${err?.message || err}`,
        );
      }
    }
    this.logger.log(`Indexes ensured (${created}/${INDEXES.length}).`);
  }
}
