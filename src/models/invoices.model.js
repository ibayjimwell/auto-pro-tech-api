import { pgTable, uuid, numeric, text, timestamp, index } from 'drizzle-orm/pg-core';
import { Appointments } from './appointments.model.js';
import { Staff } from './staff.model.js';
import { InvoiceTypeEnum, InvoiceStatusEnum } from './enums/invoice-formats.enums.js';

export const Invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => Appointments.id).notNull(),
  invoiceType: InvoiceTypeEnum('invoice_type').notNull(),
  status: InvoiceStatusEnum('status').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default(0).notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  approvedAt: timestamp('approved_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  issuedByStaffId: uuid('issued_by_staff_id').references(() => Staff.id),
}, (table) => ({
  appointmentIdIdx: index('invoices_appointment_idx').on(table.appointmentId),
  statusIdx: index('invoices_status_idx').on(table.status),
}));
