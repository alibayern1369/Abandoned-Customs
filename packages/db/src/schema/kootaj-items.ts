import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { kootajs } from './kootajs.js';
import { importBatches, fileTypeEnum } from './import-batches.js';
import { importRows } from './import-rows.js';

/**
 * Physical/detail rows belonging to one Kootaj (1:N).
 * Item-level fields only — parent declaration totals stay on kootajs.
 */
export const kootajItems = pgTable(
  'kootaj_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kootajId: uuid('kootaj_id')
      .notNull()
      .references(() => kootajs.id, { onDelete: 'restrict' }),
    lineNo: integer('line_no'),
    rowItemNo: text('row_item_no'),
    tariffCode: text('tariff_code'),
    goodsDescription: text('goods_description'),
    grossWeight: numeric('gross_weight', { precision: 20, scale: 6 }),
    netWeight: numeric('net_weight', { precision: 20, scale: 6 }),
    packageCount: numeric('package_count', { precision: 20, scale: 4 }),
    packageType: text('package_type'),
    manufacturerCountry: text('manufacturer_country'),
    warehouseReceiptNo: text('warehouse_receipt_no'),
    eWarehouseReceiptNo: text('e_warehouse_receipt_no'),
    sourceFileType: fileTypeEnum('source_file_type').notNull(),
    sourceRowNumber: integer('source_row_number'),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'restrict',
    }),
    importRowId: uuid('import_row_id').references(() => importRows.id, {
      onDelete: 'set null',
    }),
    rawSnapshot: jsonb('raw_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('kootaj_items_kootaj_id_idx').on(table.kootajId),
    index('kootaj_items_goods_description_idx').on(table.goodsDescription),
    index('kootaj_items_tariff_code_idx').on(table.tariffCode),
    index('kootaj_items_warehouse_receipt_no_idx').on(table.warehouseReceiptNo),
    index('kootaj_items_import_batch_id_idx').on(table.importBatchId),
  ],
);
