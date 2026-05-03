import { pgTable, uuid, text, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { InspectionTasks } from './inspection-tasks.model.js';

export const TaskProducts = pgTable('task_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => InspectionTasks.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').default(1),
  price: decimal('price', { precision: 10, scale: 2 }).default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('task_products_task_idx').on(table.taskId),
}));