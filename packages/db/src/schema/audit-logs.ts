import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { importBatches } from './import-batches.js';

/**
 * Append-only audit trail.
 * Application must never UPDATE/DELETE. DB trigger enforces immutability.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    metadata: jsonb('metadata'),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      // RESTRICT: append-only trigger blocks ON DELETE SET NULL (would UPDATE audit_logs)
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    index('audit_logs_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_created_at_idx').on(table.createdAt),
    index('audit_logs_import_batch_id_idx').on(table.importBatchId),
  ],
);
