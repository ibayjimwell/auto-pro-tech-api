import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { Customers } from './customers.model.js';

export const PushTokens = pgTable('push_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .references(() => Customers.id, { onDelete: 'cascade' })
    .notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  platform: varchar('platform', { length: 20 }), // 'ios' or 'android'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('push_tokens_customer_idx').on(table.customerId),
  tokenIdx: index('push_tokens_token_idx').on(table.token),
}));