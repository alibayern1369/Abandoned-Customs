/**
 * Map File2 analysis records → kootajs / kootaj_items insert shapes.
 * source_origin = FILE2. Parent declaration totals: FIRST / CONFLICT_KEEP_FIRST — never SUM.
 */

import { getCol } from '../excel.js';
import { FILE2_FIELDS } from '../aggregate.js';
import { cellToString } from '../normalize.js';
import type { ExcelRow, KootajRecord } from '../types.js';
import { itemNumeric, itemText, levelNumeric, levelText, stripInternalKeys } from './map-helpers.js';

export interface File2KootajInsert {
  normalizedKootaj: string;
  displayKootaj: string | null;
  sourceOrigin: 'FILE2';
  kootajDate: string | null;
  ownerName: string | null;
  ownerCode: string | null;
  brokerName: string | null;
  brokerCode: string | null;
  declarantName: string | null;
  declarantCode: string | null;
  rialValue: string | null;
  fxValue: string | null;
  fxCurrency: string | null;
  fxRate: string | null;
  originCountry: string | null;
  exportCountry: string | null;
  tradeCountry: string | null;
  orderRegistrationNo: string | null;
  hasParentFieldConflict: boolean;
}

export interface File2ItemInsert {
  lineNo: number;
  tariffCode: string | null;
  goodsDescription: string | null;
  grossWeight: string | null;
  netWeight: string | null;
  packageCount: string | null;
  packageType: string | null;
  manufacturerCountry: string | null;
  warehouseReceiptNo: string | null;
  eWarehouseReceiptNo: string | null;
  sourceFileType: 'FILE2';
  sourceRowNumber: number;
  rawSnapshot: Record<string, unknown>;
}

/** Map parent-level File2 fields (FIRST / CONFLICT_KEEP_FIRST — never SUM). */
export function mapFile2Kootaj(record: KootajRecord): File2KootajInsert {
  const level = record.kootaj_level;
  return {
    normalizedKootaj: record.normalized_kootaj,
    displayKootaj: record.original_values[0] ?? record.normalized_kootaj,
    sourceOrigin: 'FILE2',
    kootajDate: levelText(level, 'زمان کوتاژ'),
    ownerName: levelText(level, 'نام صاحب کالا'),
    ownerCode: levelText(level, 'کدينگ صاحب کالا'),
    brokerName: levelText(level, 'نام کارگزار گمرکی'),
    brokerCode: levelText(level, 'کدينگ کارگزار گمرکی'),
    declarantName: levelText(level, 'نام اظهار کننده'),
    declarantCode: levelText(level, 'کدينگ اظهار کننده'),
    rialValue: levelNumeric(level, 'ارزش ریالی اظهارنامه'),
    fxValue: levelNumeric(level, 'ارزش ارزی اظهارنامه'),
    fxCurrency: levelText(level, 'نوع ارز'),
    fxRate: levelNumeric(level, 'نرخ ارز'),
    originCountry: levelText(level, 'کشور مبدا'),
    exportCountry: levelText(level, 'کشور صادرکننده'),
    tradeCountry: levelText(level, 'کشور طرف معامله'),
    orderRegistrationNo: levelText(level, 'شماره ثبت سفارش'),
    hasParentFieldConflict: record.parent_field_conflicts.length > 0,
  };
}

/**
 * Map one physical File2 detail row to a kootaj_items insert.
 * `sourceRow` must include `_source_row` (Excel 1-based + header).
 */
export function mapFile2Item(sourceRow: ExcelRow, lineNo: number): File2ItemInsert {
  const sourceRowNumber = Number(sourceRow._source_row);
  if (!Number.isFinite(sourceRowNumber)) {
    throw new Error('mapFile2Item requires _source_row on the Excel row');
  }

  const warehouse = itemText(sourceRow, FILE2_FIELDS.warehouse);
  const eWarehouseRaw = cellToString(getCol(sourceRow, FILE2_FIELDS.eWarehouse));
  const eWarehouse = eWarehouseRaw === '' ? null : eWarehouseRaw;

  return {
    lineNo,
    tariffCode: itemText(sourceRow, 'کد اچ اس کالا'),
    goodsDescription: itemText(sourceRow, 'نام کالا'),
    grossWeight: itemNumeric(sourceRow, 'وزن ناخالص'),
    netWeight: itemNumeric(sourceRow, 'وزن خالص'),
    packageCount: itemNumeric(sourceRow, 'تعداد بسته'),
    packageType: itemText(sourceRow, 'نوع بسته'),
    manufacturerCountry: itemText(sourceRow, 'کشور سازنده'),
    warehouseReceiptNo: warehouse,
    eWarehouseReceiptNo: eWarehouse,
    sourceFileType: 'FILE2',
    sourceRowNumber,
    rawSnapshot: stripInternalKeys(sourceRow),
  };
}
