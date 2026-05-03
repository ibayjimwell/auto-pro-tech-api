import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { Appointments } from './appointments.model.js';

export const InspectionTasks = pgTable('inspection_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => Appointments.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING, IN_PROGRESS, DONE
  order: integer('order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  appointmentIdx: index('inspection_tasks_appointment_idx').on(table.appointmentId),
}));