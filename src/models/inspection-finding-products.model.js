import { pgTable, uuid, integer, decimal, timestamp } from 'drizzle-orm/pg-core';
import { InspectionFindings } from './inspection-findings.model.js';
import { InventoryItems } from './inventory-items.model.js';

export const InspectionFindingProducts = pgTable('inspection_finding_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  findingId: uuid('finding_id').references(() => InspectionFindings.id, { onDelete: 'cascade' }).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => InventoryItems.id).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  priceAtTime: decimal('price_at_time', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});