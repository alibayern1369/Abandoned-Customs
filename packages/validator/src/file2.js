import { getCol } from './excel.js';
import { normalizeKootaj, cellToString } from './normalize.js';
import {
  FILE2_FIELDS,
  buildKootajLevel,
  buildItemDetails,
  computeSafeAggregates,
} from './aggregate.js';

/**
 * Process File 2 against File 1 Kootaj set.
 * EXISTING → SKIP (no overwrite). NEW → collect parent + item details.
 */
export function processFile2(workbook, file1KootajSet) {
  const sheetName = workbook.sheetNames[0];
  const rows = workbook.sheets[sheetName];

  const groups = new Map();
  let emptyKeyRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = getCol(row, ...FILE2_FIELDS.kootajColAlts);
    const { original_value, normalized_value } = normalizeKootaj(raw);
    if (!normalized_value) {
      emptyKeyRows += 1;
      continue;
    }
    if (!groups.has(normalized_value)) {
      groups.set(normalized_value, {
        normalized_kootaj: normalized_value,
        original_values: new Set(),
        rows: [],
      });
    }
    const g = groups.get(normalized_value);
    g.original_values.add(original_value);
    g.rows.push({ ...row, _source_row: i + 2 });
  }

  const existing = [];
  const neu = [];
  const suspicious = [];
  let duplicateRowExtras = 0;

  for (const g of groups.values()) {
    if (g.rows.length > 1) duplicateRowExtras += g.rows.length - 1;

    const { level, conflicts } = buildKootajLevel(g.rows, FILE2_FIELDS.kootajLevel);
    const items = buildItemDetails(g.rows, FILE2_FIELDS.itemLevel, [
      FILE2_FIELDS.warehouse,
      FILE2_FIELDS.eWarehouse,
    ]);
    const warehouses = [
      ...new Set(
        g.rows
          .map((r) => cellToString(getCol(r, FILE2_FIELDS.warehouse)))
          .filter((v) => v !== '' && v !== '-'),
      ),
    ];

    const aggregates = computeSafeAggregates(g.rows, {
      weightFields: ['وزن ناخالص', 'وزن خالص'],
      packageFields: ['تعداد بسته'],
      valueFields: ['ارزش ریالی اظهارنامه', 'ارزش ارزی اظهارنامه'],
    });

    const record = {
      normalized_kootaj: g.normalized_kootaj,
      original_values: [...g.original_values],
      row_count: g.rows.length,
      warehouse_receipt_count: warehouses.length,
      warehouse_receipts: warehouses,
      kootaj_level: flattenLevel(level),
      items,
      aggregates,
      parent_field_conflicts: conflicts,
      classification: null,
    };

    if (conflicts.length) {
      suspicious.push({
        normalized_kootaj: g.normalized_kootaj,
        reason: 'conflicting_kootaj_level_fields',
        conflicts,
        row_count: g.rows.length,
      });
    }
    if (warehouses.length > 1) {
      suspicious.push({
        normalized_kootaj: g.normalized_kootaj,
        reason: 'multiple_warehouse_receipts',
        warehouse_receipts: warehouses,
      });
    }

    if (file1KootajSet.has(g.normalized_kootaj)) {
      record.classification = 'EXISTING_SKIPPED';
      existing.push(record);
    } else {
      record.classification = 'NEW';
      neu.push(record);
    }
  }

  existing.sort((a, b) => a.normalized_kootaj.localeCompare(b.normalized_kootaj, 'en', { numeric: true }));
  neu.sort((a, b) => a.normalized_kootaj.localeCompare(b.normalized_kootaj, 'en', { numeric: true }));

  // Row-level existing count (for comparison with prior analysis)
  let existingRows = 0;
  let newRows = 0;
  for (const g of groups.values()) {
    if (file1KootajSet.has(g.normalized_kootaj)) existingRows += g.rows.length;
    else newRows += g.rows.length;
  }

  return {
    sheet: sheetName,
    physical_rows: rows.length,
    unique_kootajs: groups.size,
    empty_key_rows: emptyKeyRows,
    existing_kootajs: existing.length,
    new_kootajs: neu.length,
    existing_rows: existingRows,
    new_rows: newRows,
    duplicate_extra_rows: duplicateRowExtras,
    groups_with_multiple_rows: [...groups.values()].filter((g) => g.rows.length > 1).length,
    suspicious,
    existing,
    new: neu,
  };
}

function flattenLevel(level) {
  const out = {};
  for (const [k, v] of Object.entries(level)) {
    out[k] = v.value;
    if (v.rule === 'CONFLICT_KEEP_FIRST') {
      out[`${k}__conflict`] = v.distinct_values.join(' | ');
    }
  }
  return out;
}
