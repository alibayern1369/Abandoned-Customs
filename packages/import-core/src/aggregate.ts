/**
 * Aggregation rules discovered during analysis.
 * Ported from @metrookeh/validator — behavior must stay identical.
 * Never blindly SUM declaration-level totals.
 */

import { normalizeNumber, cellToString } from './normalize.js';
import type { AggregateNumber, ExcelRow, FieldValue, ParentFieldConflict } from './types.js';

const FILE1_KOOTAJ_LEVEL = [
  'تاریخ کوتاژ',
  'ارزش ریالی کالا',
  'ارزش ارزی اظهارنامه',
  'محل ارزیابی',
  'مرحله اظهارنامه',
  'حقوق استنباطی گمرک',
  'واریزی اموال تملیکی',
  'وضعیت کالا',
  'تاریخ اعلام به اموال تملیکی',
  'تاریخ خروج کالا  از گمرک توسط اموال تملیکی',
];

const FILE1_ITEM_LEVEL = ['کد تعرفه', 'شرح کالا', 'وزن ناخالص'];

const FILE2_KOOTAJ_LEVEL = [
  'زمان کوتاژ',
  'نام صاحب کالا',
  'کدينگ صاحب کالا',
  'نام کارگزار گمرکی',
  'کدينگ کارگزار گمرکی',
  'نام اظهار کننده',
  'کدينگ اظهار کننده',
  'نوع ارز',
  'نرخ ارز',
  'ارزش ارزی اظهارنامه',
  'ارزش ریالی اظهارنامه',
  'کشور مبدا',
  'کشور صادرکننده',
  'کشور طرف معامله',
  'شماره ثبت سفارش',
];

// Never SUM these even if numeric — declaration totals repeated per item row
const NEVER_SUM_FIELDS = new Set([
  'ارزش ریالی کالا',
  'ارزش ارزی اظهارنامه',
  'ارزش ریالی اظهارنامه',
  'حقوق استنباطی گمرک',
  'نرخ ارز',
  'بیمه',
  'کرایه',
  'واریزی اموال تملیکی',
]);

const SUMMABLE_ITEM_FIELDS = new Set(['وزن ناخالص', 'وزن خالص', 'تعداد بسته']);

function distinctNonEmpty(values: unknown[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = cellToString(v);
    if (s !== '') set.add(s);
  }
  return [...set];
}

function pickFirstNonEmpty(values: unknown[]): string {
  for (const v of values) {
    const s = cellToString(v);
    if (s !== '') return s;
  }
  return '';
}

/**
 * Build Kootaj-level fields from grouped rows.
 * Identical repeated totals → FIRST/ANY (never SUM).
 * Conflicting parent fields → flagged, not silently merged.
 */
export function buildKootajLevel(
  rows: ExcelRow[],
  fieldNames: string[],
): { level: Record<string, FieldValue>; conflicts: ParentFieldConflict[] } {
  const level: Record<string, FieldValue> = {};
  const conflicts: ParentFieldConflict[] = [];

  for (const field of fieldNames) {
    const values = rows.map((r) => r[field]);
    const distinct = distinctNonEmpty(values);
    if (distinct.length <= 1) {
      level[field] = {
        value: pickFirstNonEmpty(values),
        rule: NEVER_SUM_FIELDS.has(field) ? 'FIRST_NEVER_SUM' : 'FIRST',
        distinct_count: distinct.length,
      };
    } else {
      level[field] = {
        value: pickFirstNonEmpty(values),
        rule: 'CONFLICT_KEEP_FIRST',
        distinct_count: distinct.length,
        distinct_values: distinct.slice(0, 10),
      };
      conflicts.push({ field, distinct_values: distinct });
    }
  }

  return { level, conflicts };
}

/**
 * Item-level detail rows (preserve all).
 */
export function buildItemDetails(
  rows: ExcelRow[],
  itemFields: string[],
  extraFields: string[] = [],
): Record<string, unknown>[] {
  return rows.map((row, idx) => {
    const item: Record<string, unknown> = { source_row_index: idx };
    for (const f of [...itemFields, ...extraFields]) {
      if (Object.prototype.hasOwnProperty.call(row, f) || row[f] !== undefined) {
        item[f] = cellToString(row[f]);
      }
    }
    return item;
  });
}

/**
 * Safe totals for item-level numeric fields only.
 * Weights / package counts: SUM of detail rows when they differ or are per-item.
 * Declaration values / duties: NEVER summed — take FIRST distinct.
 */
export function computeSafeAggregates(
  rows: ExcelRow[],
  {
    weightFields = [],
    packageFields = [],
    valueFields = [],
  }: {
    weightFields?: string[];
    packageFields?: string[];
    valueFields?: string[];
  },
): Record<string, AggregateNumber> {
  const result: Record<string, AggregateNumber> = {};

  for (const f of weightFields) {
    const nums = rows.map((r) => normalizeNumber(r[f])).filter((n): n is number => n != null);
    result[f] = {
      rule: 'SUM_ITEM_WEIGHTS',
      sum: nums.reduce((a, b) => a + b, 0),
      distinct: [...new Set(nums.map(String))],
      row_count: nums.length,
    };
  }

  for (const f of packageFields) {
    const nums = rows.map((r) => normalizeNumber(r[f])).filter((n): n is number => n != null);
    result[f] = {
      rule: 'SUM_ITEM_PACKAGES',
      sum: nums.reduce((a, b) => a + b, 0),
      distinct: [...new Set(nums.map(String))],
      row_count: nums.length,
    };
  }

  for (const f of valueFields) {
    const nums = rows.map((r) => normalizeNumber(r[f])).filter((n): n is number => n != null);
    const distinct = [...new Set(nums)];
    result[f] = {
      rule: 'FIRST_NEVER_SUM',
      value: distinct.length ? distinct[0] : null,
      distinct_count: distinct.length,
      would_be_wrong_sum: nums.reduce((a, b) => a + b, 0),
      warning:
        distinct.length > 1
          ? 'conflicting_declaration_totals'
          : nums.length > 1
            ? 'repeated_total_not_summed'
            : null,
    };
  }

  return result;
}

export const FILE1_FIELDS = {
  kootajLevel: FILE1_KOOTAJ_LEVEL,
  itemLevel: FILE1_ITEM_LEVEL,
  warehouse: 'شماره قبض انبار',
  kootajCol: 'شماره کوتاژ',
};

export const FILE2_FIELDS = {
  kootajLevel: FILE2_KOOTAJ_LEVEL,
  itemLevel: [
    'نام کالا',
    'کد اچ اس کالا',
    'تعداد بسته',
    'وزن خالص',
    'وزن ناخالص',
    'نوع بسته',
    'کشور سازنده',
  ],
  warehouse: 'شماره قبض انبار',
  eWarehouse: 'شماره قبض انبار الکترونیکی',
  kootajCol: 'شماره مجوز بارگيري',
  // alternate spellings with ی/ي
  kootajColAlts: ['شماره مجوز بارگيري', 'شماره مجوز بارگیری'],
};

export { NEVER_SUM_FIELDS, SUMMABLE_ITEM_FIELDS };
