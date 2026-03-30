import { pgTable, uuid, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const Staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  role: varchar('role', { length: 50 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('staff_email_idx').on(table.email),
}));