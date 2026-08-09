import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { importBatches } from './import-batches.js';

export const importRowProcessingStatusEnum = pgEnum('import_row_processing_status', [
  'PENDING',
  'PROCESSED',
  'FAILED',
  'SKIPPED',
]);

export const importRowDispositionEnum = pgEnum('import_row_disposition', [
  'CREATED_KOOTAJ',
  'CREATED_ITEM',
  'SKIPPED_EXISTING',
  'LETTER_ATTACHED',
  'LETTER_DRAFT_IGNORED',
  'UNMATCHED',
  'EXTRACTION_FAILED',
  'CONFLICT',
  'PARENT_FIELD_CONFLICT',
  'IGNORED_EMPTY_KEY',
  'ERROR',
  'REVIEW',
]);

/**
 * Provenance: one row per physical Excel row processed.
 * raw_payload preserves original cells for "where did this value come from?"
 */
export const importRows = pgTable(
  'import_rows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    importBatchId: uuid('import_batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    sourceRowNumber: integer('source_row_number').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    normalizedKootaj: text('normalized_kootaj'),
    processingStatus: importRowProcessingStatusEnum('processing_status')
      .notNull()
      .default('PENDING'),
    disposition: importRowDispositionEnum('disposition'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('import_rows_import_batch_id_idx').on(table.importBatchId),
    index('import_rows_normalized_kootaj_idx').on(table.normalizedKootaj),
    index('import_rows_processing_status_idx').on(table.processingStatus),
    index('import_rows_disposition_idx').on(table.disposition),
  ],
);
