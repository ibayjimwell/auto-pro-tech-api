import { pgTable, uuid, varchar, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { Appointments } from './appointments.model.js';

export const EstimateAdjustments = pgTable('estimate_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => Appointments.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'labor' or 'discount'
  label: varchar('label', { length: 255 }).default('Labor'), // optional description
  amount: decimal('amount', { precision: 10, scale: 2 }), // for fixed discounts or labor amount
  discountType: varchar('discount_type', { length: 20 }), // 'fixed' or 'percentage'
  discountValue: decimal('discount_value', { precision: 5, scale: 2 }), // for percentage
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  appointmentIdIdx: index('estimate_adj_appointment_idx').on(table.appointmentId),
}));