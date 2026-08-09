import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const fileTypeEnum = pgEnum('file_type', ['FILE1', 'FILE2', 'FILE3']);

export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'RUNNING',
  'COMPLETED',
  'COMPLETED_WITH_REVIEW',
  'FAILED',
]);

export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileName: text('file_name').notNull(),
    fileType: fileTypeEnum('file_type').notNull(),
    status: importBatchStatusEnum('status').notNull().default('RUNNING'),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    totalRows: integer('total_rows').notNull().default(0),
    createdRecords: integer('created_records').notNull().default(0),
    skippedRecords: integer('skipped_records').notNull().default(0),
    reviewRecords: integer('review_records').notNull().default(0),
    errorRecords: integer('error_records').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('import_batches_file_type_idx').on(table.fileType),
    index('import_batches_status_idx').on(table.status),
    index('import_batches_created_by_idx').on(table.createdBy),
    index('import_batches_imported_at_idx').on(table.importedAt),
  ],
);
