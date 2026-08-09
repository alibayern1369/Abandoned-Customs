/**
 * Collect File2 physical rows grouped by normalized Kootaj (with _source_row).
 * Mirrors processFile2 grouping without changing analysis output shape.
 */

import { getCol } from '../excel.js';
import { normalizeKootaj } from '../normalize.js';
import { FILE2_FIELDS } from '../aggregate.js';
import type { ExcelRow, Workbook } from '../types.js';

export interface File2PhysicalGroup {
  normalizedKootaj: string;
  rows: ExcelRow[];
}

export function collectFile2PhysicalGroups(workbook: Workbook): {
  sheet: string;
  physicalRows: ExcelRow[];
  groups: Map<string, File2PhysicalGroup>;
} {
  const sheet = workbook.sheetNames[0];
  if (!sheet || !workbook.sheets[sheet]) {
    throw new Error(`File 2 missing sheet. Found: ${workbook.sheetNames.join(', ')}`);
  }

  const physicalRows = workbook.sheets[sheet];
  const groups = new Map<string, File2PhysicalGroup>();

  for (let i = 0; i < physicalRows.length; i++) {
    const row = physicalRows[i];
    const raw = getCol(row, ...FILE2_FIELDS.kootajColAlts);
    const { normalized_value } = normalizeKootaj(raw);
    if (!normalized_value) continue;

    if (!groups.has(normalized_value)) {
      groups.set(normalized_value, { normalizedKootaj: normalized_value, rows: [] });
    }
    groups.get(normalized_value)!.rows.push({ ...row, _source_row: i + 2 });
  }

  return { sheet, physicalRows, groups };
}
