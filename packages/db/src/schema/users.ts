import {
  pgEnum,
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'viewer',
  'importer',
  'reviewer',
  'admin',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: userRoleEnum('role').notNull().default('viewer'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_username_uidx').on(table.username),
    index('users_role_idx').on(table.role),
  ],
);
