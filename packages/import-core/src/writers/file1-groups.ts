/**
 * Collect File1 physical rows grouped by normalized Kootaj (with _source_row).
 * Mirrors processFile1 grouping without changing analysis output shape.
 */

import { getCol } from '../excel.js';
import { normalizeKootaj } from '../normalize.js';
import { FILE1_FIELDS } from '../aggregate.js';
import type { ExcelRow, Workbook } from '../types.js';

const MASTER_SHEET = 'متروکه کلی';

export interface File1PhysicalGroup {
  normalizedKootaj: string;
  rows: ExcelRow[];
}

export function collectFile1PhysicalGroups(workbook: Workbook): {
  sheet: string;
  physicalRows: ExcelRow[];
  groups: Map<string, File1PhysicalGroup>;
} {
  if (!workbook.sheets[MASTER_SHEET]) {
    throw new Error(
      `File 1 missing master sheet "${MASTER_SHEET}". Found: ${workbook.sheetNames.join(', ')}`,
    );
  }

  const physicalRows = workbook.sheets[MASTER_SHEET];
  const groups = new Map<string, File1PhysicalGroup>();

  for (let i = 0; i < physicalRows.length; i++) {
    const row = physicalRows[i];
    const raw = getCol(row, FILE1_FIELDS.kootajCol);
    const { normalized_value } = normalizeKootaj(raw);
    if (!normalized_value) continue;

    if (!groups.has(normalized_value)) {
      groups.set(normalized_value, { normalizedKootaj: normalized_value, rows: [] });
    }
    groups.get(normalized_value)!.rows.push({ ...row, _source_row: i + 2 });
  }

  return { sheet: MASTER_SHEET, physicalRows, groups };
}
