import { pgTable, uuid, varchar, text, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';

export const InventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  category: varchar('category', { length: 100 }),
  stockQty: integer('stock_qty').default(0).notNull(),
  minThreshold: integer('min_threshold').default(5),
  unit: varchar('unit', { length: 20 }).default('pc'),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
  sellPrice: decimal('sell_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  skuIdx: index('inventory_sku_idx').on(table.sku),
}));