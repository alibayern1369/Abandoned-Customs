import { getCol } from './excel.js';
import { normalizeKootaj, cellToString } from './normalize.js';
import {
  FILE1_FIELDS,
  buildKootajLevel,
  buildItemDetails,
  computeSafeAggregates,
} from './aggregate.js';

const MASTER_SHEET = 'متروکه کلی';

/**
 * Process File 1 (master sheet only).
 * Groups multiple physical rows under one Kootaj parent.
 */
export function processFile1(workbook) {
  if (!workbook.sheets[MASTER_SHEET]) {
    throw new Error(`File 1 missing master sheet "${MASTER_SHEET}". Found: ${workbook.sheetNames.join(', ')}`);
  }

  const rows = workbook.sheets[MASTER_SHEET];
  const groups = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = getCol(row, FILE1_FIELDS.kootajCol);
    const { original_value, normalized_value } = normalizeKootaj(raw);
    if (!normalized_value) continue;

    if (!groups.has(normalized_value)) {
      groups.set(normalized_value, {
        normalized_kootaj: normalized_value,
        original_values: new Set(),
        rows: [],
      });
    }
    const g = groups.get(normalized_value);
    g.original_values.add(original_value);
    g.rows.push({ ...row, _source_row: i + 2 }); // Excel 1-based + header
  }

  const kootajs = [];
  let multiRow = 0;
  let multiWarehouse = 0;

  for (const g of groups.values()) {
    const { level, conflicts } = buildKootajLevel(g.rows, FILE1_FIELDS.kootajLevel);
    const items = buildItemDetails(g.rows, FILE1_FIELDS.itemLevel, [
      FILE1_FIELDS.warehouse,
      'ردیف',
    ]);

    const warehouses = [
      ...new Set(
        g.rows
          .map((r) => cellToString(getCol(r, FILE1_FIELDS.warehouse)))
          .filter((v) => v !== ''),
      ),
    ];

    const aggregates = computeSafeAggregates(g.rows, {
      weightFields: ['وزن ناخالص'],
      packageFields: [],
      valueFields: ['ارزش ریالی کالا', 'ارزش ارزی اظهارنامه', 'حقوق استنباطی گمرک'],
    });

    if (g.rows.length > 1) multiRow += 1;
    if (warehouses.length > 1) multiWarehouse += 1;

    kootajs.push({
      normalized_kootaj: g.normalized_kootaj,
      original_values: [...g.original_values],
      row_count: g.rows.length,
      warehouse_receipt_count: warehouses.length,
      warehouse_receipts: warehouses,
      kootaj_level: level,
      items,
      aggregates,
      parent_field_conflicts: conflicts,
    });
  }

  kootajs.sort((a, b) => a.normalized_kootaj.localeCompare(b.normalized_kootaj, 'en', { numeric: true }));

  const set = new Map(kootajs.map((k) => [k.normalized_kootaj, k]));

  return {
    sheet: MASTER_SHEET,
    physical_rows: rows.length,
    unique_kootajs: kootajs.length,
    kootajs_with_multiple_rows: multiRow,
    kootajs_with_multiple_warehouse_receipts: multiWarehouse,
    kootajs,
    kootajSet: set,
  };
}
