import {
  pgEnum,
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { importBatches } from './import-batches.js';

/** Origin of the parent Kootaj row — only FILE1 or FILE2 may create parents. */
export const sourceOriginEnum = pgEnum('source_origin', ['FILE1', 'FILE2']);

/**
 * Parent entity: one row per normalized Kootaj.
 * Do NOT put a single mega-status here — letter/exit/review/origin stay independent.
 * Exit classification is deferred; store raw File1 exit text only.
 */
export const kootajs = pgTable(
  'kootajs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    normalizedKootaj: text('normalized_kootaj').notNull(),
    displayKootaj: text('display_kootaj'),
    sourceOrigin: sourceOriginEnum('source_origin').notNull(),
    createdImportBatchId: uuid('created_import_batch_id').references(() => importBatches.id, {
      onDelete: 'restrict',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Parent-level fields (validator FILE1_KOOTAJ_LEVEL / FILE2_KOOTAJ_LEVEL)
    kootajDate: text('kootaj_date'),
    ownerName: text('owner_name'),
    ownerCode: text('owner_code'),
    brokerName: text('broker_name'),
    brokerCode: text('broker_code'),
    declarantName: text('declarant_name'),
    declarantCode: text('declarant_code'),
    assessmentLocation: text('assessment_location'),
    declarationStage: text('declaration_stage'),
    rialValue: numeric('rial_value', { precision: 20, scale: 4 }),
    fxValue: numeric('fx_value', { precision: 20, scale: 4 }),
    fxCurrency: text('fx_currency'),
    fxRate: numeric('fx_rate', { precision: 20, scale: 6 }),
    customsInferredDuty: numeric('customs_inferred_duty', { precision: 20, scale: 4 }),
    tamlikDeposit: numeric('tamlik_deposit', { precision: 20, scale: 4 }),
    /** Raw File1 وضعیت کالا — independent lifecycle text, not a mega-status. */
    goodsStatusText: text('goods_status_text'),
    announcedToTamlikText: text('announced_to_tamlik_text'),
    /** Raw File1 exit/date text — derived EXITED/NOT_EXITED deferred. */
    exitText: text('exit_text'),
    originCountry: text('origin_country'),
    exportCountry: text('export_country'),
    tradeCountry: text('trade_country'),
    orderRegistrationNo: text('order_registration_no'),
    hasParentFieldConflict: boolean('has_parent_field_conflict').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('kootajs_normalized_kootaj_uidx').on(table.normalizedKootaj),
    index('kootajs_source_origin_idx').on(table.sourceOrigin),
    index('kootajs_owner_name_idx').on(table.ownerName),
    index('kootajs_order_registration_no_idx').on(table.orderRegistrationNo),
    index('kootajs_created_import_batch_id_idx').on(table.createdImportBatchId),
  ],
);
