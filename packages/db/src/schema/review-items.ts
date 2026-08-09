import {
  pgEnum,
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { importBatches } from './import-batches.js';
import { importRows } from './import-rows.js';
import { kootajs } from './kootajs.js';
import { users } from './users.js';

export const reviewItemTypeEnum = pgEnum('review_item_type', [
  'EXTRACTION_FAILED',
  'UNMATCHED',
  'LETTER_CONFLICT',
  'PARENT_FIELD_CONFLICT',
]);

export const reviewItemStatusEnum = pgEnum('review_item_status', [
  'OPEN',
  'RESOLVED',
  'IGNORED',
]);

/**
 * Deterministic processing exceptions. Never auto-resolve conflicts.
 */
export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: reviewItemTypeEnum('type').notNull(),
    status: reviewItemStatusEnum('status').notNull().default('OPEN'),
    importBatchId: uuid('import_batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    importRowId: uuid('import_row_id').references(() => importRows.id, {
      onDelete: 'set null',
    }),
    kootajId: uuid('kootaj_id').references(() => kootajs.id, {
      onDelete: 'set null',
    }),
    normalizedKootaj: text('normalized_kootaj'),
    payload: jsonb('payload').notNull().default({}),
    resolutionNote: text('resolution_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('review_items_status_idx').on(table.status),
    index('review_items_type_idx').on(table.type),
    index('review_items_status_type_idx').on(table.status, table.type),
    index('review_items_import_batch_id_idx').on(table.importBatchId),
    index('review_items_kootaj_id_idx').on(table.kootajId),
    index('review_items_normalized_kootaj_idx').on(table.normalizedKootaj),
  ],
);
