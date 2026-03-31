import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { Appointments } from './appointments.model.js';
import { Staff } from './staff.model.js';
import { AppointmentStatusEnum } from './enums/appointment-status.enum.js';

/**
 * APPOINTMENT_STATUS_LOG tracks all status changes for appointments.
 * Used for audit trail and status history.
 */
export const AppointmentStatusLogs = pgTable('appointment_status_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => Appointments.id).notNull(),
  previousStatus: AppointmentStatusEnum('previous_status'),
  status: AppointmentStatusEnum('status').notNull(),
  notes: text('notes'),
  changedBy: uuid('changed_by').references(() => Staff.id),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
}, (table) => ({
  appointmentIdIdx: index('status_logs_appointment_idx').on(table.appointmentId),
  changedAtIdx: index('status_logs_changed_at_idx').on(table.changedAt),
}));
