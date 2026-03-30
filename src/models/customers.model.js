import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const Customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('customers_email_idx').on(table.email),
}));