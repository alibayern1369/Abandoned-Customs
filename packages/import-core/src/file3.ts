/**
 * Process File 3 automation export.
 * Ported from @metrookeh/validator — behavior must stay identical.
 * Match against unified Kootaj set (File1 + File2 NEW). Do NOT create Kootajs.
 */

import { getCol } from './excel.js';
import {
  extractKootajFromDescription,
  normalizeLetterNumber,
  normalizeLetterDate,
  cellToString,
} from './normalize.js';
import type { File3ProcessedRow, File3Result, Workbook } from './types.js';

/**
 * Process File 3 automation export.
 * Match against unified Kootaj set (File1 + File2 NEW). Do NOT create Kootajs.
 */
export function processFile3(
  workbook: Workbook,
  unifiedKootajSet: Set<string> | Map<string, unknown>,
): File3Result {
  const sheetName = workbook.sheetNames[0];
  const rows = workbook.sheets[sheetName];

  const processed: File3ProcessedRow[] = [];
  let extractOk = 0;
  let extractFail = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const description = cellToString(getCol(row, 'توضیحات'));
    const extracted = extractKootajFromDescription(description);

    const letterNumberRaw = getCol(row, 'شماره ثبت');
    const letterDateRaw = getCol(row, 'تاریخ ثبت');
    const letterDateFallbackRaw = getCol(row, 'تاریخ تهیه');
    const letterSystemId = cellToString(getCol(row, 'شناسه نامه'));

    const letter_number_original = cellToString(letterNumberRaw);
    const letter_number = normalizeLetterNumber(letterNumberRaw);
    const letter_date_original = cellToString(letterDateRaw) || cellToString(letterDateFallbackRaw);
    const letter_date =
      normalizeLetterDate(letterDateRaw) || normalizeLetterDate(letterDateFallbackRaw);
    const letter_date_source = cellToString(letterDateRaw)
      ? 'تاریخ ثبت'
      : cellToString(letterDateFallbackRaw)
        ? 'تاریخ تهیه'
        : null;

    const hasValidLetter = Boolean(letter_number);

    let match_status: File3ProcessedRow['match_status'] = 'EXTRACTION_FAILED';
    if (extracted.ok && extracted.normalized_value) {
      extractOk += 1;
      if (unifiedKootajSet.has(extracted.normalized_value)) {
        match_status = 'MATCHED';
      } else {
        match_status = 'UNMATCHED';
      }
    } else {
      extractFail += 1;
    }

    processed.push({
      source_row: i + 2,
      letter_system_id: letterSystemId,
      description,
      extraction: extracted,
      normalized_kootaj: extracted.normalized_value,
      letter_number_original,
      letter_number,
      letter_date_original,
      letter_date,
      letter_date_source,
      has_valid_letter: hasValidLetter,
      match_status,
      registrar: cellToString(getCol(row, 'ثبت كننده', 'ثبت کننده')),
    });
  }

  // Group by Kootaj for letter conflict detection
  const byKootaj = new Map<string, File3ProcessedRow[]>();
  for (const row of processed) {
    if (!row.normalized_kootaj) continue;
    if (!byKootaj.has(row.normalized_kootaj)) byKootaj.set(row.normalized_kootaj, []);
    byKootaj.get(row.normalized_kootaj)!.push(row);
  }

  const letterOutcomes: Array<Record<string, unknown>> = [];
  const conflicts: Array<Record<string, unknown>> = [];
  const validLetters: Array<Record<string, unknown>> = [];
  const draftsOnly: Array<Record<string, unknown>> = [];

  for (const [kootaj, group] of byKootaj) {
    const matched = group[0].match_status === 'MATCHED';
    const withLetter = group.filter((r) => r.has_valid_letter);
    const distinctLetters = [...new Set(withLetter.map((r) => r.letter_number).filter(Boolean))];

    let letter_status: string | undefined;
    if (distinctLetters.length > 1) {
      letter_status = 'CONFLICT';
      conflicts.push({
        normalized_kootaj: kootaj,
        match_status: matched ? 'MATCHED' : 'UNMATCHED',
        candidate_count: distinctLetters.length,
        candidates: withLetter.map((r) => ({
          source_row: r.source_row,
          letter_system_id: r.letter_system_id,
          letter_number: r.letter_number,
          letter_date: r.letter_date,
        })),
        draft_rows_ignored: group.filter((r) => !r.has_valid_letter).length,
      });
    } else if (distinctLetters.length === 1) {
      letter_status = 'VALID_SINGLE_LETTER';
      const chosen = withLetter[0];
      validLetters.push({
        normalized_kootaj: kootaj,
        match_status: matched ? 'MATCHED' : 'UNMATCHED',
        letter_number: chosen.letter_number,
        letter_date: chosen.letter_date,
        letter_system_id: chosen.letter_system_id,
        total_automation_rows: group.length,
        draft_rows_ignored: group.length - withLetter.length,
      });
    } else if (group.length > 0) {
      letter_status = 'NO_VALID_LETTER';
      draftsOnly.push({
        normalized_kootaj: kootaj,
        match_status: matched ? 'MATCHED' : 'UNMATCHED',
        automation_rows: group.length,
      });
    }

    letterOutcomes.push({
      normalized_kootaj: kootaj,
      automation_row_count: group.length,
      valid_letter_candidates: distinctLetters.length,
      letter_status,
      match_status: matched ? 'MATCHED' : 'UNMATCHED',
    });
  }

  const matchedRows = processed.filter((r) => r.match_status === 'MATCHED');
  const unmatchedRows = processed.filter((r) => r.match_status === 'UNMATCHED');
  const failedRows = processed.filter((r) => r.match_status === 'EXTRACTION_FAILED');

  const matchedKootajs = new Set(matchedRows.map((r) => r.normalized_kootaj).filter(Boolean));
  const unmatchedKootajs = new Set(unmatchedRows.map((r) => r.normalized_kootaj).filter(Boolean));

  const rowsWithRegistration = processed.filter((r) => r.has_valid_letter).length;

  return {
    sheet: sheetName,
    physical_rows: rows.length,
    successfully_extracted_kootajs_rows: extractOk,
    failed_kootaj_extraction: extractFail,
    unique_extracted_kootajs: byKootaj.size,
    rows_with_registration_number: rowsWithRegistration,
    matched_rows: matchedRows.length,
    unmatched_rows: unmatchedRows.length,
    matched_kootajs: matchedKootajs.size,
    unmatched_kootajs: unmatchedKootajs.size,
    kootajs_with_valid_letters: validLetters.length,
    kootajs_with_multiple_letter_candidates: conflicts.length,
    conflicts_count: conflicts.length,
    kootajs_with_multiple_automation_rows: [...byKootaj.values()].filter((g) => g.length > 1)
      .length,
    processed,
    matched: matchedRows,
    unmatched: unmatchedRows,
    extraction_failed: failedRows,
    conflicts,
    valid_letters: validLetters,
    no_letter: draftsOnly,
    letter_outcomes: letterOutcomes,
  };
}
