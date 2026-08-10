/**
 * Map File1 analysis records → kootajs / kootaj_items insert shapes.
 */

import { FILE1_FIELDS } from '../aggregate.js';
import type { ExcelRow, KootajRecord } from '../types.js';
import { itemNumeric, itemText, levelNumeric, levelText, stripInternalKeys } from './map-helpers.js';

/** Owner of abandoned (متروکه) goods — File1 has no separate owner column. */
export const FILE1_DEFAULT_OWNER_NAME = 'سازمان اموال تملیکی';

export interface File1KootajInsert {
  normalizedKootaj: string;
  displayKootaj: string | null;
  sourceOrigin: 'FILE1';
  kootajDate: string | null;
  ownerName: string | null;
  assessmentLocation: string | null;
  declarationStage: string | null;
  rialValue: string | null;
  fxValue: string | null;
  customsInferredDuty: string | null;
  tamlikDeposit: string | null;
  goodsStatusText: string | null;
  announcedToTamlikText: string | null;
  exitText: string | null;
  hasParentFieldConflict: boolean;
}

export interface File1ItemInsert {
  lineNo: number;
  rowItemNo: string | null;
  tariffCode: string | null;
  goodsDescription: string | null;
  grossWeight: string | null;
  warehouseReceiptNo: string | null;
  sourceFileType: 'FILE1';
  sourceRowNumber: number;
  rawSnapshot: Record<string, unknown>;
}

/** Map parent-level File1 fields (FIRST / CONFLICT_KEEP_FIRST — never SUM). */
export function mapFile1Kootaj(record: KootajRecord): File1KootajInsert {
  const level = record.kootaj_level;
  return {
    normalizedKootaj: record.normalized_kootaj,
    displayKootaj: record.original_values[0] ?? record.normalized_kootaj,
    sourceOrigin: 'FILE1',
    kootajDate: levelText(level, 'تاریخ کوتاژ'),
    ownerName: FILE1_DEFAULT_OWNER_NAME,
    assessmentLocation: levelText(level, 'محل ارزیابی'),
    declarationStage: levelText(level, 'مرحله اظهارنامه'),
    rialValue: levelNumeric(level, 'ارزش ریالی کالا'),
    fxValue: levelNumeric(level, 'ارزش ارزی اظهارنامه'),
    customsInferredDuty: levelNumeric(level, 'حقوق استنباطی گمرک'),
    tamlikDeposit: levelNumeric(level, 'واریزی اموال تملیکی'),
    goodsStatusText: levelText(level, 'وضعیت کالا'),
    announcedToTamlikText: levelText(level, 'تاریخ اعلام به اموال تملیکی'),
    exitText: levelText(level, 'تاریخ خروج کالا  از گمرک توسط اموال تملیکی'),
    hasParentFieldConflict: record.parent_field_conflicts.length > 0,
  };
}

/**
 * Map one physical File1 detail row to a kootaj_items insert.
 * `sourceRow` must include `_source_row` (Excel 1-based + header).
 */
export function mapFile1Item(sourceRow: ExcelRow, lineNo: number): File1ItemInsert {
  const sourceRowNumber = Number(sourceRow._source_row);
  if (!Number.isFinite(sourceRowNumber)) {
    throw new Error('mapFile1Item requires _source_row on the Excel row');
  }

  return {
    lineNo,
    rowItemNo: itemText(sourceRow, 'ردیف'),
    tariffCode: itemText(sourceRow, 'کد تعرفه'),
    goodsDescription: itemText(sourceRow, 'شرح کالا'),
    grossWeight: itemNumeric(sourceRow, 'وزن ناخالص'),
    warehouseReceiptNo: itemText(sourceRow, FILE1_FIELDS.warehouse),
    sourceFileType: 'FILE1',
    sourceRowNumber,
    rawSnapshot: stripInternalKeys(sourceRow),
  };
}
