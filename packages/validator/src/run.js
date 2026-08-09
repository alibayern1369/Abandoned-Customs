#!/usr/bin/env node
/**
 * Read-only Metrookeh validator / processing prototype.
 *
 * Usage:
 *   node src/run.js
 *   node src/run.js <file1.xlsx> <file2.xlsx> <file3.xls> [outputDir]
 *
 * Does NOT modify source Excel files.
 * Does NOT write a production database.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSourcePaths, readWorkbook } from './excel.js';
import { processFile1 } from './file1.js';
import { processFile2 } from './file2.js';
import { processFile3 } from './file3.js';
import { generateOutputs } from './report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Soft expectations from prior analysis — compared AFTER processing, never hardcoded into logic. */
const PRIOR_ANALYSIS_EXPECTATIONS = {
  file1_unique_kootajs: 598,
  // Prior write-up sometimes said "554 existing"; measured unique skip = 526, row-level = 554
  file2_existing_kootajs: 526,
  file2_new_kootajs: 50,
  file2_existing_rows: 554,
  file3_physical_rows: 86,
  file3_rows_with_registration: 77,
};

function buildUnifiedSet(file1, file2) {
  const set = new Set(file1.kootajSet.keys());
  for (const k of file2.new) set.add(k.normalized_kootaj);
  return set;
}

export function runValidation(paths) {
  const wb1 = readWorkbook(paths.file1);
  const wb2 = readWorkbook(paths.file2);
  const wb3 = readWorkbook(paths.file3);

  const file1 = processFile1(wb1);
  const file2 = processFile2(wb2, file1.kootajSet);
  const unified = buildUnifiedSet(file1, file2);
  const file3 = processFile3(wb3, unified);

  return { file1, file2, file3, unifiedSize: unified.size };
}

function main() {
  const paths = resolveSourcePaths(process.argv.slice(2));
  // Default output beside validator package
  if (!process.argv[2] || process.argv.length < 4) {
    paths.outputDir = path.resolve(__dirname, '..', 'output');
  }

  console.log('READ-ONLY validator starting...');
  console.log('File 1:', paths.file1);
  console.log('File 2:', paths.file2);
  console.log('File 3:', paths.file3);
  console.log('Output:', paths.outputDir);

  const { file1, file2, file3, unifiedSize } = runValidation(paths);

  const { summary, discrepancies, reportText } = generateOutputs(
    {
      paths,
      file1,
      file2,
      file3,
      expectations: PRIOR_ANALYSIS_EXPECTATIONS,
    },
    paths.outputDir,
  );

  console.log('\n' + reportText);
  console.log(`\nUnified Kootaj set size (File1 + File2 NEW): ${unifiedSize}`);
  console.log(`Outputs written to: ${paths.outputDir}`);

  if (discrepancies.length) {
    console.error('\n*** STOP: results differ from prior analysis expectations ***');
    for (const d of discrepancies) {
      console.error(`  ${d.metric}: expected=${d.expected} actual=${d.actual}`);
    }
    process.exitCode = 2;
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  try {
    main();
  } catch (err) {
    console.error('Validator failed:', err);
    process.exit(1);
  }
}
