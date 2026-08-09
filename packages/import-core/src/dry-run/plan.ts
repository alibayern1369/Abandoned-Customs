/**
 * Build dry-run plans from Excel workbooks.
 * Disposition = what production writers WOULD do (Phase 4–6); no DB writes here.
 */

import path from 'node:path';
import { getCol } from '../excel.js';
import { normalizeKootaj, cellToString } from '../normalize.js';
import { FILE1_FIELDS, FILE2_FIELDS } from '../aggregate.js';
import { processFile1 } from '../file1.js';
import { processFile2 } from '../file2.js';
import { processFile3 } from '../file3.js';
import { buildUnifiedSet } from '../pipeline.js';
import type { ExcelRow, Workbook } from '../types.js';
import type {
  DryRunBatchCounters,
  DryRunFileType,
  DryRunPlan,
  PlannedImportRow,
} from './types.js';

function stripInternalKeys(row: ExcelRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

function emptyCounters(): DryRunBatchCounters {
  return {
    totalRows: 0,
    createdRecords: 0,
    skippedRecords: 0,
    reviewRecords: 0,
    errorRecords: 0,
  };
}

function finalizeStatus(counters: DryRunBatchCounters): DryRunPlan['finalStatus'] {
  if (counters.errorRecords > 0 && counters.createdRecords === 0 && counters.skippedRecords === 0) {
    return 'FAILED';
  }
  if (counters.reviewRecords > 0) return 'COMPLETED_WITH_REVIEW';
  return 'COMPLETED';
}

function fileBaseName(workbook: Workbook, fallback: string): string {
  if (workbook.filePath) return path.basename(workbook.filePath);
  return fallback;
}

/** Plan File1 dry-run rows: CREATE parent + items (no DB). */
export function planFile1DryRun(workbook: Workbook): DryRunPlan {
  const analysis = processFile1(workbook);
  const rows = workbook.sheets[analysis.sheet];
  const planned: PlannedImportRow[] = [];
  const counters = emptyCounters();
  counters.totalRows = rows.length;

  const seenKootaj = new Set<string>();
  const conflictKootajs = new Set(
    analysis.kootajs.filter((k) => k.parent_field_conflicts.length > 0).map((k) => k.normalized_kootaj),
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourceRowNumber = i + 2;
    const raw = getCol(row, FILE1_FIELDS.kootajCol);
    const { normalized_value } = normalizeKootaj(raw);

    if (!normalized_value) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: null,
        processingStatus: 'SKIPPED',
        disposition: 'IGNORED_EMPTY_KEY',
        errorMessage: 'Empty or invalid Kootaj key',
      });
      counters.skippedRecords += 1;
      continue;
    }

    const isFirst = !seenKootaj.has(normalized_value);
    if (isFirst) seenKootaj.add(normalized_value);
    const hasConflict = conflictKootajs.has(normalized_value);

    if (hasConflict) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'PROCESSED',
        disposition: 'PARENT_FIELD_CONFLICT',
        errorMessage: 'Parent-level field conflict — would create with FIRST values + review',
      });
      counters.reviewRecords += 1;
      if (isFirst) counters.createdRecords += 1;
    } else if (isFirst) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'PROCESSED',
        disposition: 'CREATED_KOOTAJ',
        errorMessage: null,
      });
      counters.createdRecords += 1;
    } else {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'PROCESSED',
        disposition: 'CREATED_ITEM',
        errorMessage: null,
      });
    }
  }

  return {
    fileType: 'FILE1',
    fileName: fileBaseName(workbook, 'file1.xlsx'),
    sheet: analysis.sheet,
    rows: planned,
    counters,
    finalStatus: finalizeStatus(counters),
    summary: {
      physical_rows: analysis.physical_rows,
      unique_kootajs: analysis.unique_kootajs,
      kootajs_with_multiple_rows: analysis.kootajs_with_multiple_rows,
      parent_field_conflict_kootajs: conflictKootajs.size,
      dry_run: true,
      domain_writes: false,
    },
  };
}

/** Plan File2 dry-run rows: SKIP existing / CREATE new (no DB). */
export function planFile2DryRun(
  workbook: Workbook,
  file1KootajSet: Map<string, unknown> | Set<string>,
): DryRunPlan {
  const analysis = processFile2(workbook, file1KootajSet);
  const rows = workbook.sheets[analysis.sheet];
  const planned: PlannedImportRow[] = [];
  const counters = emptyCounters();
  counters.totalRows = rows.length;

  const classification = new Map<string, 'EXISTING_SKIPPED' | 'NEW'>();
  for (const k of analysis.existing) classification.set(k.normalized_kootaj, 'EXISTING_SKIPPED');
  for (const k of analysis.new) classification.set(k.normalized_kootaj, 'NEW');

  const seenNewKootaj = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourceRowNumber = i + 2;
    const raw = getCol(row, ...FILE2_FIELDS.kootajColAlts);
    const { normalized_value } = normalizeKootaj(raw);

    if (!normalized_value) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: null,
        processingStatus: 'SKIPPED',
        disposition: 'IGNORED_EMPTY_KEY',
        errorMessage: 'Empty or invalid Kootaj key',
      });
      counters.skippedRecords += 1;
      continue;
    }

    const cls = classification.get(normalized_value);
    if (cls === 'EXISTING_SKIPPED') {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'SKIPPED',
        disposition: 'SKIPPED_EXISTING',
        errorMessage: 'File2 SKIP — Kootaj already known from File1',
      });
      counters.skippedRecords += 1;
      continue;
    }

    const isFirst = !seenNewKootaj.has(normalized_value);
    if (isFirst) seenNewKootaj.add(normalized_value);
    if (isFirst) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'PROCESSED',
        disposition: 'CREATED_KOOTAJ',
        errorMessage: null,
      });
      counters.createdRecords += 1;
    } else {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: normalized_value,
        processingStatus: 'PROCESSED',
        disposition: 'CREATED_ITEM',
        errorMessage: null,
      });
    }
  }

  return {
    fileType: 'FILE2',
    fileName: fileBaseName(workbook, 'file2.xlsx'),
    sheet: analysis.sheet,
    rows: planned,
    counters,
    finalStatus: finalizeStatus(counters),
    summary: {
      physical_rows: analysis.physical_rows,
      unique_kootajs: analysis.unique_kootajs,
      existing_kootajs: analysis.existing_kootajs,
      new_kootajs: analysis.new_kootajs,
      existing_rows: analysis.existing_rows,
      new_rows: analysis.new_rows,
      empty_key_rows: analysis.empty_key_rows,
      dry_run: true,
      domain_writes: false,
    },
  };
}

/** Plan File3 dry-run rows: letter attach / review only (never create Kootaj). */
export function planFile3DryRun(
  workbook: Workbook,
  unifiedKootajSet: Set<string> | Map<string, unknown>,
): DryRunPlan {
  const analysis = processFile3(workbook, unifiedKootajSet);
  const rows = workbook.sheets[analysis.sheet];
  const planned: PlannedImportRow[] = [];
  const counters = emptyCounters();
  counters.totalRows = rows.length;

  // Per-Kootaj letter outcome for conflict / attach decisions
  const letterStatus = new Map<string, string | undefined>();
  for (const o of analysis.letter_outcomes) {
    letterStatus.set(String(o.normalized_kootaj), o.letter_status as string | undefined);
  }

  // First valid-letter row per matched kootaj with a single letter → LETTER_ATTACHED
  const attachedRow = new Map<string, number>();
  for (const vl of analysis.valid_letters) {
    if (vl.match_status !== 'MATCHED') continue;
    const kootaj = String(vl.normalized_kootaj);
    const group = analysis.processed.filter(
      (r) => r.normalized_kootaj === kootaj && r.has_valid_letter,
    );
    if (group.length > 0) attachedRow.set(kootaj, group[0].source_row);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourceRowNumber = i + 2;
    const processed = analysis.processed[i];
    const nk = processed.normalized_kootaj;

    if (processed.match_status === 'EXTRACTION_FAILED') {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: null,
        processingStatus: 'PROCESSED',
        disposition: 'EXTRACTION_FAILED',
        errorMessage: processed.extraction.reason ?? 'Kootaj extraction failed',
      });
      counters.reviewRecords += 1;
      continue;
    }

    if (processed.match_status === 'UNMATCHED') {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: nk,
        processingStatus: 'PROCESSED',
        disposition: 'UNMATCHED',
        errorMessage: 'File3 never creates Kootaj — unmatched extraction',
      });
      counters.reviewRecords += 1;
      continue;
    }

    // MATCHED
    const status = nk ? letterStatus.get(nk) : undefined;

    if (status === 'CONFLICT') {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: nk,
        processingStatus: 'PROCESSED',
        disposition: 'CONFLICT',
        errorMessage: 'Multiple distinct letter numbers for same Kootaj',
      });
      counters.reviewRecords += 1;
      continue;
    }

    if (!processed.has_valid_letter) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: nk,
        processingStatus: 'SKIPPED',
        disposition: 'LETTER_DRAFT_IGNORED',
        errorMessage: 'No valid letter registration number',
      });
      counters.skippedRecords += 1;
      continue;
    }

    if (nk && attachedRow.get(nk) === sourceRowNumber) {
      planned.push({
        sourceRowNumber,
        rawPayload: stripInternalKeys(row),
        normalizedKootaj: nk,
        processingStatus: 'PROCESSED',
        disposition: 'LETTER_ATTACHED',
        errorMessage: null,
      });
      counters.createdRecords += 1;
      continue;
    }

    planned.push({
      sourceRowNumber,
      rawPayload: stripInternalKeys(row),
      normalizedKootaj: nk,
      processingStatus: 'SKIPPED',
      disposition: 'LETTER_DRAFT_IGNORED',
      errorMessage: 'Additional automation row for same letter — ignored',
    });
    counters.skippedRecords += 1;
  }

  return {
    fileType: 'FILE3',
    fileName: fileBaseName(workbook, 'file3.xls'),
    sheet: analysis.sheet,
    rows: planned,
    counters,
    finalStatus: finalizeStatus(counters),
    summary: {
      physical_rows: analysis.physical_rows,
      matched_rows: analysis.matched_rows,
      unmatched_rows: analysis.unmatched_rows,
      extraction_failed: analysis.failed_kootaj_extraction,
      rows_with_registration: analysis.rows_with_registration_number,
      valid_letters: analysis.kootajs_with_valid_letters,
      conflicts: analysis.conflicts_count,
      dry_run: true,
      domain_writes: false,
    },
  };
}

export function planDryRun(
  fileType: DryRunFileType,
  workbook: Workbook,
  context?: {
    file1KootajSet?: Map<string, unknown> | Set<string>;
    unifiedKootajSet?: Set<string> | Map<string, unknown>;
  },
): DryRunPlan {
  if (fileType === 'FILE1') return planFile1DryRun(workbook);
  if (fileType === 'FILE2') {
    if (!context?.file1KootajSet) {
      throw new Error('planDryRun(FILE2) requires file1KootajSet');
    }
    return planFile2DryRun(workbook, context.file1KootajSet);
  }
  if (!context?.unifiedKootajSet) {
    throw new Error('planDryRun(FILE3) requires unifiedKootajSet');
  }
  return planFile3DryRun(workbook, context.unifiedKootajSet);
}

/** Plan all three files in File1→File2→File3 order (analysis context shared). */
export function planFullDryRun(paths: {
  file1: Workbook;
  file2: Workbook;
  file3: Workbook;
}): { file1: DryRunPlan; file2: DryRunPlan; file3: DryRunPlan } {
  const f1 = processFile1(paths.file1);
  const f2 = processFile2(paths.file2, f1.kootajSet);
  const unified = buildUnifiedSet(f1, f2);

  return {
    file1: planFile1DryRun(paths.file1),
    file2: planFile2DryRun(paths.file2, f1.kootajSet),
    file3: planFile3DryRun(paths.file3, unified),
  };
}

export { cellToString };
