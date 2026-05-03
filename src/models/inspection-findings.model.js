import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { InspectionTasks } from './inspection-tasks.model.js';

export const InspectionFindings = pgTable('inspection_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => InspectionTasks.id, { onDelete: 'cascade' }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('inspection_findings_task_idx').on(table.taskId),
}));