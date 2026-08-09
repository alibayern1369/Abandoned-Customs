import {
  pgEnum,
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { importBatches, fileTypeEnum } from './import-batches.js';

export const mergeDraftStatusEnum = pgEnum('merge_draft_status', [
  'AWAITING_RESOLUTION',
  'APPLIED',
  'CANCELLED',
]);

/**
 * Temporary upload-merge report awaiting per-field user decisions.
 * Separate from File2 SKIP CLI path.
 */
export const mergeDrafts = pgTable(
  'merge_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileName: text('file_name').notNull(),
    fileType: fileTypeEnum('file_type').notNull(),
    status: mergeDraftStatusEnum('status').notNull().default('AWAITING_RESOLUTION'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    report: jsonb('report').notNull(),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => [
    index('merge_drafts_status_idx').on(table.status),
    index('merge_drafts_created_by_idx').on(table.createdBy),
    index('merge_drafts_created_at_idx').on(table.createdAt),
  ],
);
