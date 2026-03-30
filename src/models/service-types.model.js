import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const ServiceTypes = pgTable('service_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});