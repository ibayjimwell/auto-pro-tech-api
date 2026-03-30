import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { Customers } from './customers.model.js';

export const Vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => Customers.id, { onDelete: 'cascade' }).notNull(),
  plateNumber: varchar('plate_number', { length: 20 }).unique().notNull(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  plateIdx: index('vehicles_plate_idx').on(table.plateNumber),
  customerIdx: index('vehicles_customer_idx').on(table.customerId),
}));