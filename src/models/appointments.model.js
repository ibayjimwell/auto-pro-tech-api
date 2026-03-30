import { pgTable, uuid, date, time, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { Customers } from './customers.model.js';
import { Vehicles } from './vehicles.model.js';
import { ServiceTypes } from './service-types.model.js';
import { Staff } from './staff.model.js';
import { AppointmentStatusEnum } from './enums/appointment-status.enum.js';

export const Appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => Customers.id).notNull(),
  vehicleId: uuid('vehicle_id').references(() => Vehicles.id).notNull(),
  serviceTypeId: uuid('service_type_id').references(() => ServiceTypes.id).notNull(),
  assignedStaffId: uuid('assigned_staff_id').references(() => Staff.id),
  appointmentDate: date('appointment_date').notNull(),
  appointmentTime: time('appointment_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull(), // snapshot of service duration
  status: AppointmentStatusEnum('status').default('PENDING').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  dateIdx: index('appointments_date_idx').on(table.appointmentDate),
  customerIdx: index('appointments_customer_idx').on(table.customerId),
}));