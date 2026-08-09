/**
 * Read-only analysis pipeline (Phase 2).
 * Orchestrates File1 → File2 → File3 without any DB writes.
 */

import { readWorkbook } from './excel.js';
import { processFile1 } from './file1.js';
import { processFile2 } from './file2.js';
import { processFile3 } from './file3.js';
import {
  PRIOR_ANALYSIS_EXPECTATIONS,
  type File1Result,
  type File2Result,
  type File3Result,
  type PriorAnalysisExpectations,
  type SourcePaths,
} from './types.js';

export interface AnalysisResult {
  file1: File1Result;
  file2: File2Result;
  file3: File3Result;
  unifiedSize: number;
}

export interface CountSummary {
  file1_physical_rows: number;
  file1_unique_kootajs: number;
  file1_multi_row_kootajs: number;
  file1_multi_warehouse_kootajs: number;
  file2_physical_rows: number;
  file2_unique_kootajs: number;
  file2_existing_kootajs: number;
  file2_new_kootajs: number;
  file2_existing_rows: number;
  file2_new_rows: number;
  file2_duplicate_extra_rows: number;
  file2_suspicious: number;
  file3_physical_rows: number;
  file3_extracted_ok: number;
  file3_extract_failed: number;
  file3_rows_with_registration: number;
  file3_matched_rows: number;
  file3_unmatched_rows: number;
  file3_matched_kootajs: number;
  file3_unmatched_kootajs: number;
  file3_valid_letters: number;
  file3_multi_letter_candidates: number;
  file3_conflicts: number;
}

export interface CountDiscrepancy {
  metric: string;
  expected: number;
  actual: number;
}

export function buildUnifiedSet(file1: File1Result, file2: File2Result): Set<string> {
  const set = new Set(file1.kootajSet.keys());
  for (const k of file2.new) set.add(k.normalized_kootaj);
  return set;
}

/** Run the full File1→File2→File3 analysis. No persistence. */
export function runAnalysis(paths: Pick<SourcePaths, 'file1' | 'file2' | 'file3'>): AnalysisResult {
  const wb1 = readWorkbook(paths.file1);
  const wb2 = readWorkbook(paths.file2);
  const wb3 = readWorkbook(paths.file3);

  const file1 = processFile1(wb1);
  const file2 = processFile2(wb2, file1.kootajSet);
  const unified = buildUnifiedSet(file1, file2);
  const file3 = processFile3(wb3, unified);

  return { file1, file2, file3, unifiedSize: unified.size };
}

export function buildCountSummary(result: AnalysisResult): CountSummary {
  const { file1, file2, file3 } = result;
  return {
    file1_physical_rows: file1.physical_rows,
    file1_unique_kootajs: file1.unique_kootajs,
    file1_multi_row_kootajs: file1.kootajs_with_multiple_rows,
    file1_multi_warehouse_kootajs: file1.kootajs_with_multiple_warehouse_receipts,
    file2_physical_rows: file2.physical_rows,
    file2_unique_kootajs: file2.unique_kootajs,
    file2_existing_kootajs: file2.existing_kootajs,
    file2_new_kootajs: file2.new_kootajs,
    file2_existing_rows: file2.existing_rows,
    file2_new_rows: file2.new_rows,
    file2_duplicate_extra_rows: file2.duplicate_extra_rows,
    file2_suspicious: file2.suspicious.length,
    file3_physical_rows: file3.physical_rows,
    file3_extracted_ok: file3.successfully_extracted_kootajs_rows,
    file3_extract_failed: file3.failed_kootaj_extraction,
    file3_rows_with_registration: file3.rows_with_registration_number,
    file3_matched_rows: file3.matched_rows,
    file3_unmatched_rows: file3.unmatched_rows,
    file3_matched_kootajs: file3.matched_kootajs,
    file3_unmatched_kootajs: file3.unmatched_kootajs,
    file3_valid_letters: file3.kootajs_with_valid_letters,
    file3_multi_letter_candidates: file3.kootajs_with_multiple_letter_candidates,
    file3_conflicts: file3.conflicts_count,
  };
}

export function compareCountLocks(
  summary: CountSummary,
  expectations: PriorAnalysisExpectations = PRIOR_ANALYSIS_EXPECTATIONS,
): CountDiscrepancy[] {
  const checks: Array<[keyof PriorAnalysisExpectations, keyof CountSummary]> = [
    ['file1_unique_kootajs', 'file1_unique_kootajs'],
    ['file2_existing_kootajs', 'file2_existing_kootajs'],
    ['file2_new_kootajs', 'file2_new_kootajs'],
    ['file2_existing_rows', 'file2_existing_rows'],
    ['file3_physical_rows', 'file3_physical_rows'],
    ['file3_rows_with_registration', 'file3_rows_with_registration'],
  ];

  const discrepancies: CountDiscrepancy[] = [];
  for (const [expectKey, summaryKey] of checks) {
    const expected = expectations[expectKey];
    const actual = summary[summaryKey];
    if (actual !== expected) {
      discrepancies.push({ metric: expectKey, expected, actual });
    }
  }
  return discrepancies;
}
