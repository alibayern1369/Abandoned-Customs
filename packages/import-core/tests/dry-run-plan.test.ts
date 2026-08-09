/**
 * Phase 3 dry-run planner unit tests (no DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  planFile1DryRun,
  planFile2DryRun,
  planFile3DryRun,
  getImportCoreReadiness,
} from '../src/index.js';
import type { Workbook } from '../src/types.js';

function wb(sheetName: string, rows: Record<string, unknown>[]): Workbook {
  return {
    sheetNames: [sheetName],
    sheets: { [sheetName]: rows },
    filePath: `/tmp/${sheetName}.xlsx`,
  };
}

describe('getImportCoreReadiness', () => {
  it('reports File1 + File2 + File3 writers as Phase 6', () => {
    const r = getImportCoreReadiness();
    assert.equal(r.phase, 6);
    assert.equal(r.file1WriterImplemented, true);
    assert.equal(r.file2WriterImplemented, true);
    assert.equal(r.file3WriterImplemented, true);
    assert.equal(r.domainWritesImplemented, true);
  });
});

describe('planFile1DryRun', () => {
  it('plans CREATED_KOOTAJ / CREATED_ITEM and ignores empty keys', () => {
    const workbook = wb('متروکه کلی', [
      { 'شماره کوتاژ': '111', 'شرح کالا': 'A', 'وزن ناخالص': '1' },
      { 'شماره کوتاژ': '111', 'شرح کالا': 'B', 'وزن ناخالص': '2' },
      { 'شماره کوتاژ': '222', 'شرح کالا': 'C', 'وزن ناخالص': '3' },
      { 'شماره کوتاژ': '', 'شرح کالا': 'D', 'وزن ناخالص': '4' },
    ]);

    const plan = planFile1DryRun(workbook);
    assert.equal(plan.fileType, 'FILE1');
    assert.equal(plan.rows.length, 4);
    assert.equal(plan.rows[0].disposition, 'CREATED_KOOTAJ');
    assert.equal(plan.rows[1].disposition, 'CREATED_ITEM');
    assert.equal(plan.rows[2].disposition, 'CREATED_KOOTAJ');
    assert.equal(plan.rows[3].disposition, 'IGNORED_EMPTY_KEY');
    assert.equal(plan.counters.createdRecords, 2);
    assert.equal(plan.counters.skippedRecords, 1);
    assert.equal(plan.counters.totalRows, 4);
    assert.equal(plan.finalStatus, 'COMPLETED');
    assert.equal(plan.summary.domain_writes, false);
  });
});

describe('planFile2DryRun', () => {
  it('plans SKIP for existing and CREATE for new', () => {
    const file1Set = new Set(['111']);
    const workbook = wb('sheet1', [
      { 'شماره مجوز بارگيري': '111', 'شرح کالا': 'old' },
      { 'شماره مجوز بارگيري': '999', 'شرح کالا': 'new1' },
      { 'شماره مجوز بارگيري': '999', 'شرح کالا': 'new2' },
      { 'شماره مجوز بارگيري': '', 'شرح کالا': 'empty' },
    ]);

    const plan = planFile2DryRun(workbook, file1Set);
    assert.equal(plan.rows[0].disposition, 'SKIPPED_EXISTING');
    assert.equal(plan.rows[1].disposition, 'CREATED_KOOTAJ');
    assert.equal(plan.rows[2].disposition, 'CREATED_ITEM');
    assert.equal(plan.rows[3].disposition, 'IGNORED_EMPTY_KEY');
    assert.equal(plan.counters.createdRecords, 1);
    assert.equal(plan.counters.skippedRecords, 2);
    assert.equal(plan.summary.existing_kootajs, 1);
    assert.equal(plan.summary.new_kootajs, 1);
  });
});

describe('planFile3DryRun', () => {
  it('plans attach / unmatched / extraction / draft dispositions', () => {
    const unified = new Set(['5555']);
    const workbook = wb('sheet1', [
      {
        توضیحات: 'شماره کوتاژ 5555',
        'شماره ثبت': 'L-1',
        'تاریخ ثبت': '1403/01/01',
        'شناسه نامه': 'S1',
      },
      {
        توضیحات: 'شماره کوتاژ 5555',
        'شماره ثبت': '',
        'تاریخ ثبت': '',
        'شناسه نامه': 'S2',
      },
      {
        توضیحات: 'شماره کوتاژ 7777',
        'شماره ثبت': 'L-2',
        'تاریخ ثبت': '1403/01/02',
        'شناسه نامه': 'S3',
      },
      {
        توضیحات: 'بدون کوتاژ معتبر',
        'شماره ثبت': 'L-3',
        'تاریخ ثبت': '1403/01/03',
        'شناسه نامه': 'S4',
      },
    ]);

    const plan = planFile3DryRun(workbook, unified);
    assert.equal(plan.rows[0].disposition, 'LETTER_ATTACHED');
    assert.equal(plan.rows[1].disposition, 'LETTER_DRAFT_IGNORED');
    assert.equal(plan.rows[2].disposition, 'UNMATCHED');
    assert.equal(plan.rows[3].disposition, 'EXTRACTION_FAILED');
    assert.equal(plan.counters.createdRecords, 1);
    assert.ok(plan.counters.reviewRecords >= 2);
    assert.equal(plan.finalStatus, 'COMPLETED_WITH_REVIEW');
  });
});
