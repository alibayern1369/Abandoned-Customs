import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(','));
  }
  fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
}

function writeXlsx(filePath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: 'empty' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filePath);
}

/**
 * Build human-readable report + machine-readable CSV/XLSX outputs.
 * All writes go to outputDir only — never touch source Excel files.
 */
export function generateOutputs({ paths, file1, file2, file3, expectations }, outputDir) {
  ensureDir(outputDir);

  const summary = {
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

  const discrepancies = compareExpectations(summary, expectations);

  const reportText = buildReportText({ paths, file1, file2, file3, summary, discrepancies });
  fs.writeFileSync(path.join(outputDir, 'validation_report.txt'), reportText, 'utf8');

  // --- machine-readable ---
  const newKootajs = file2.new.map((k) => ({
    normalized_kootaj: k.normalized_kootaj,
    original_values: k.original_values.join('|'),
    row_count: k.row_count,
    warehouse_receipts: k.warehouse_receipts.join('|'),
    زمان_کوتاژ: k.kootaj_level['زمان کوتاژ'] || '',
    ارزش_ریالی: k.kootaj_level['ارزش ریالی اظهارنامه'] || '',
    ارزش_ارزی: k.kootaj_level['ارزش ارزی اظهارنامه'] || '',
    صاحب_کالا: k.kootaj_level['نام صاحب کالا'] || '',
    weight_sum: k.aggregates['وزن ناخالص']?.sum ?? '',
    package_sum: k.aggregates['تعداد بسته']?.sum ?? '',
    item_names: k.items.map((i) => i['نام کالا']).join(' || '),
    hs_codes: k.items.map((i) => i['کد اچ اس کالا']).join(' || '),
    parent_conflicts: k.parent_field_conflicts.length,
  }));

  const skipped = file2.existing.map((k) => ({
    normalized_kootaj: k.normalized_kootaj,
    original_values: k.original_values.join('|'),
    row_count: k.row_count,
    classification: 'EXISTING_SKIPPED',
    زمان_کوتاژ: k.kootaj_level['زمان کوتاژ'] || '',
    صاحب_کالا: k.kootaj_level['نام صاحب کالا'] || '',
  }));

  const automationMatched = file3.matched.map((r) => ({
    source_row: r.source_row,
    normalized_kootaj: r.normalized_kootaj,
    letter_system_id: r.letter_system_id,
    letter_number: r.letter_number || '',
    letter_date: r.letter_date || '',
    letter_date_source: r.letter_date_source || '',
    has_valid_letter: r.has_valid_letter,
    description: r.description,
  }));

  const automationUnmatched = file3.unmatched.map((r) => ({
    source_row: r.source_row,
    normalized_kootaj: r.normalized_kootaj,
    letter_system_id: r.letter_system_id,
    letter_number: r.letter_number || '',
    letter_date: r.letter_date || '',
    has_valid_letter: r.has_valid_letter,
    description: r.description,
  }));

  const automationConflicts = file3.conflicts.flatMap((c) =>
    c.candidates.map((cand) => ({
      normalized_kootaj: c.normalized_kootaj,
      match_status: c.match_status,
      candidate_count: c.candidate_count,
      letter_system_id: cand.letter_system_id,
      letter_number: cand.letter_number,
      letter_date: cand.letter_date,
      source_row: cand.source_row,
    })),
  );

  const summaryRows = Object.entries(summary).map(([metric, value]) => ({ metric, value }));

  writeCsv(path.join(outputDir, 'new_kootajs.csv'), newKootajs, Object.keys(newKootajs[0] || { normalized_kootaj: '' }));
  writeCsv(path.join(outputDir, 'skipped_existing.csv'), skipped, Object.keys(skipped[0] || { normalized_kootaj: '' }));
  writeCsv(
    path.join(outputDir, 'automation_matched.csv'),
    automationMatched,
    Object.keys(automationMatched[0] || { source_row: '' }),
  );
  writeCsv(
    path.join(outputDir, 'automation_unmatched.csv'),
    automationUnmatched,
    Object.keys(automationUnmatched[0] || { source_row: '' }),
  );
  writeCsv(
    path.join(outputDir, 'automation_conflicts.csv'),
    automationConflicts,
    Object.keys(automationConflicts[0] || { normalized_kootaj: '' }),
  );
  writeCsv(path.join(outputDir, 'validation_summary.csv'), summaryRows, ['metric', 'value']);

  writeXlsx(path.join(outputDir, 'validation_outputs.xlsx'), {
    new_kootajs: newKootajs,
    skipped_existing: skipped,
    automation_matched: automationMatched,
    automation_unmatched: automationUnmatched,
    automation_conflicts: automationConflicts.length
      ? automationConflicts
      : [{ note: 'no conflicts' }],
    validation_summary: summaryRows,
  });

  fs.writeFileSync(
    path.join(outputDir, 'validation_summary.json'),
    JSON.stringify({ summary, discrepancies, paths }, null, 2),
    'utf8',
  );

  return { summary, discrepancies, reportText, outputDir };
}

function compareExpectations(summary, expectations) {
  const notes = [];
  // Soft expectations from prior analysis — never hardcoded into logic, only compared after.
  if (expectations) {
    for (const [key, expected] of Object.entries(expectations)) {
      const actual = summary[key];
      if (actual !== expected) {
        notes.push({
          metric: key,
          expected,
          actual,
          status: 'DIFFERS_FROM_PRIOR_ANALYSIS',
        });
      }
    }
  }
  return notes;
}

function buildReportText({ paths, file1, file2, file3, summary, discrepancies }) {
  const lines = [];
  lines.push('='.repeat(72));
  lines.push('METROOKEH READ-ONLY VALIDATION REPORT');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Mode: READ-ONLY (source Excel files were not modified)');
  lines.push('='.repeat(72));
  lines.push('');
  lines.push('INPUT FILES');
  lines.push(`  File 1: ${paths.file1}`);
  lines.push(`  File 2: ${paths.file2}`);
  lines.push(`  File 3: ${paths.file3}`);
  lines.push('');

  lines.push('## FILE 1');
  lines.push(`  Total physical rows:                      ${file1.physical_rows}`);
  lines.push(`  Unique Kootajs:                           ${file1.unique_kootajs}`);
  lines.push(`  Kootajs with multiple rows:               ${file1.kootajs_with_multiple_rows}`);
  lines.push(
    `  Kootajs with multiple warehouse receipts: ${file1.kootajs_with_multiple_warehouse_receipts}`,
  );
  lines.push(`  Master sheet:                             ${file1.sheet}`);
  lines.push('');

  lines.push('## FILE 2');
  lines.push(`  Total rows:                               ${file2.physical_rows}`);
  lines.push(`  Unique Kootajs:                           ${file2.unique_kootajs}`);
  lines.push(`  Existing Kootajs (unique, SKIPPED):       ${file2.existing_kootajs}`);
  lines.push(`  New Kootajs (unique):                     ${file2.new_kootajs}`);
  lines.push(`  Existing rows (physical):                 ${file2.existing_rows}`);
  lines.push(`  New rows (physical):                      ${file2.new_rows}`);
  lines.push(`  Duplicate extra rows (multi-item):        ${file2.duplicate_extra_rows}`);
  lines.push(`  Groups with multiple rows:                ${file2.groups_with_multiple_rows}`);
  lines.push(`  Suspicious records:                       ${file2.suspicious.length}`);
  lines.push('');

  lines.push('## FILE 3');
  lines.push(`  Total rows:                               ${file3.physical_rows}`);
  lines.push(`  Successfully extracted Kootajs (rows):    ${file3.successfully_extracted_kootajs_rows}`);
  lines.push(`  Failed Kootaj extraction:                 ${file3.failed_kootaj_extraction}`);
  lines.push(`  Unique extracted Kootajs:                 ${file3.unique_extracted_kootajs}`);
  lines.push(`  Rows with registration (شماره ثبت):       ${file3.rows_with_registration_number}`);
  lines.push(`  Matched rows:                             ${file3.matched_rows}`);
  lines.push(`  Unmatched rows:                           ${file3.unmatched_rows}`);
  lines.push(`  Matched Kootajs:                          ${file3.matched_kootajs}`);
  lines.push(`  Unmatched Kootajs:                        ${file3.unmatched_kootajs}`);
  lines.push(`  Kootajs with valid letters:               ${file3.kootajs_with_valid_letters}`);
  lines.push(`  Kootajs with multiple letter candidates:  ${file3.kootajs_with_multiple_letter_candidates}`);
  lines.push(`  Conflicts:                                ${file3.conflicts_count}`);
  lines.push(
    `  Kootajs with multiple automation rows:     ${file3.kootajs_with_multiple_automation_rows}`,
  );
  lines.push('');

  lines.push('## KEY COUNTS');
  lines.push(`  existing_kootajs (unique skip): ${summary.file2_existing_kootajs}`);
  lines.push(`  new_kootajs:                    ${summary.file2_new_kootajs}`);
  lines.push(`  unmatched_automation_rows:      ${summary.file3_unmatched_rows}`);
  lines.push(`  conflicts:                      ${summary.file3_conflicts}`);
  lines.push('');

  if (discrepancies.length) {
    lines.push('## DISCREPANCIES VS PRIOR ANALYSIS EXPECTATIONS');
    lines.push('  (Logic was NOT adjusted to force these numbers.)');
    for (const d of discrepancies) {
      lines.push(`  - ${d.metric}: expected ${d.expected}, actual ${d.actual}`);
    }
    lines.push('');
  } else {
    lines.push('## DISCREPANCIES VS PRIOR ANALYSIS EXPECTATIONS');
    lines.push('  None — results match the soft expectations from prior analysis.');
    lines.push('');
  }

  // Examples
  lines.push('## EXAMPLES');
  const newEx = file2.new[0];
  if (newEx) {
    lines.push('  NEW Kootaj example:');
    lines.push(`    kootaj=${newEx.normalized_kootaj} rows=${newEx.row_count}`);
    lines.push(`    owner=${newEx.kootaj_level['نام صاحب کالا'] || ''}`);
    lines.push(`    goods=${newEx.items.map((i) => i['نام کالا']).slice(0, 3).join(' | ')}`);
  }
  const skipEx = file2.existing[0];
  if (skipEx) {
    lines.push('  SKIPPED existing example:');
    lines.push(`    kootaj=${skipEx.normalized_kootaj} rows=${skipEx.row_count}`);
  }
  const matchEx = file3.matched.find((r) => r.has_valid_letter) || file3.matched[0];
  if (matchEx) {
    lines.push('  MATCHED automation example:');
    lines.push(
      `    kootaj=${matchEx.normalized_kootaj} letter=${matchEx.letter_number || '(draft)'} id=${matchEx.letter_system_id}`,
    );
  }
  if (file3.unmatched[0]) {
    const u = file3.unmatched[0];
    lines.push('  UNMATCHED automation example:');
    lines.push(`    kootaj=${u.normalized_kootaj} desc=${u.description}`);
  } else {
    lines.push('  UNMATCHED automation example: (none)');
  }
  if (file3.conflicts[0]) {
    const c = file3.conflicts[0];
    lines.push('  CONFLICT example:');
    lines.push(`    kootaj=${c.normalized_kootaj} candidates=${c.candidate_count}`);
  } else {
    lines.push('  CONFLICT example: (none — no multi-letter conflicts)');
  }

  lines.push('');
  lines.push('='.repeat(72));
  return lines.join('\n');
}
