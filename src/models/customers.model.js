import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const Customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(), // store hashed password
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone), // optional
}));