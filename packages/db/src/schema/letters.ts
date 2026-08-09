import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { kootajs } from './kootajs.js';
import { importBatches } from './import-batches.js';
import { importRows } from './import-rows.js';
import { users } from './users.js';

/**
 * Zero or one active letter per Kootaj.
 * UNIQUE(kootaj_id) enforces 0:1. Different second letter → review, never silent replace.
 */
export const letters = pgTable(
  'letters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kootajId: uuid('kootaj_id')
      .notNull()
      .references(() => kootajs.id, { onDelete: 'restrict' }),
    letterNumber: text('letter_number').notNull(),
    letterNumberOriginal: text('letter_number_original'),
    letterDate: text('letter_date'),
    letterDateOriginal: text('letter_date_original'),
    letterDateSource: text('letter_date_source'),
    description: text('description'),
    letterSystemId: text('letter_system_id'),
    registrar: text('registrar'),
    extractionMethod: text('extraction_method'),
    extractedKootajRaw: text('extracted_kootaj_raw'),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'restrict',
    }),
    importRowId: uuid('import_row_id').references(() => importRows.id, {
      onDelete: 'set null',
    }),
    attachedByUserId: uuid('attached_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('letters_kootaj_id_uidx').on(table.kootajId),
    index('letters_letter_number_idx').on(table.letterNumber),
    index('letters_import_batch_id_idx').on(table.importBatchId),
  ],
);
