import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const Staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(), // store hashed password
  role: varchar('role', { length: 50 }),
  active: boolean('active').default(true).notNull(),
  tempPassword: boolean('temp_password').default(false),
  tempExpiresAt: timestamp('temp_expires_at'),
  permissions: jsonb('permissions').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('staff_username_idx').on(table.username),
}));
