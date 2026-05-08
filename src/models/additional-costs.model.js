import { pgTable, uuid, varchar, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { Appointments } from './appointments.model.js';

export const AdditionalCosts = pgTable('additional_costs', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => Appointments.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'labor', 'part', 'discount'
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  discountType: varchar('discount_type', { length: 20 }), // 'fixed' or 'percentage' for discounts
  discountValue: decimal('discount_value', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  appointmentIdx: index('additional_costs_appointment_idx').on(table.appointmentId),
}));