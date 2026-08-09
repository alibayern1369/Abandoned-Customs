/**
 * Phase 6 — File3 letter attach writer tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  createDb,
  importBatches,
  importRows,
  kootajs,
  kootajItems,
  reviewItems,
  auditLogs,
  letters,
} from '@metrookeh/db';
import {
  canDiscoverSourceFiles,
  resolveSourcePaths,
  readWorkbook,
  writeFile1Import,
  writeFile2Import,
  writeFile3Import,
  mapFile3Letter,
  processFile1,
  processFile2,
  processFile3,
  planFile3DryRun,
  buildUnifiedSet,
  getImportCoreReadiness,
  decideLetterAttach,
  PRIOR_ANALYSIS_EXPECTATIONS,
  type Workbook,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.example') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';

let db: ReturnType<typeof createDb>['db'];
let client: ReturnType<typeof createDb>['client'];
const createdBatchIds: string[] = [];

before(async () => {
  ({ db, client } = createDb(databaseUrl));
});

after(async () => {
  for (const id of [...createdBatchIds].reverse()) {
    await cleanupBatch(id);
  }
  await client.end();
});

async function cleanupBatch(batchId: string) {
  // Letters may reference this batch or kootajs created by this batch
  await db.delete(letters).where(eq(letters.importBatchId, batchId));
  const parents = await db
    .select({ id: kootajs.id })
    .from(kootajs)
    .where(eq(kootajs.createdImportBatchId, batchId));
  if (parents.length > 0) {
    await db.delete(letters).where(inArray(letters.kootajId, parents.map((p) => p.id)));
  }
  await db.delete(kootajItems).where(eq(kootajItems.importBatchId, batchId));
  await db.delete(reviewItems).where(eq(reviewItems.importBatchId, batchId));
  await db.delete(kootajs).where(eq(kootajs.createdImportBatchId, batchId));
  await db.execute(sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`);
  try {
    await db.execute(sql`DELETE FROM audit_logs WHERE import_batch_id = ${batchId}`);
    await db.delete(importBatches).where(eq(importBatches.id, batchId));
  } finally {
    await db.execute(sql`ALTER TABLE audit_logs ENABLE TRIGGER ALL`);
  }
}

describe('Phase 6 readiness (file3)', () => {
  it('marks File3 writer implemented', () => {
    const r = getImportCoreReadiness();
    assert.equal(r.phase, 6);
    assert.equal(r.file3WriterImplemented, true);
    assert.equal(r.domainWritesImplemented, true);
    assert.equal(
      decideLetterAttach({
        kootajExists: true,
        hasValidLetterNumber: true,
        existingLetterNumber: null,
        incomingLetterNumber: 'L1',
      }).action,
      'ATTACH',
    );
  });
});

describe('mapFile3Letter', () => {
  it('maps File3 processed row into letter insert shape', () => {
    const analysis = processFile3(
      {
        sheetNames: ['a'],
        sheets: {
          a: [
            {
              توضیحات: 'شماره کوتاژ 800001',
              'شماره ثبت': '1405/100',
              'تاریخ ثبت': '1405/01/01',
              'شناسه نامه': 'SYS-1',
              'ثبت کننده': 'کاربر',
            },
          ],
        },
      },
      new Set(['800001']),
    );

    const mapped = mapFile3Letter(analysis.processed[0]);
    assert.equal(mapped.letterNumber, '1405/100');
    assert.equal(mapped.letterSystemId, 'SYS-1');
    assert.equal(mapped.registrar, 'کاربر');
    assert.ok(mapped.extractionMethod);
  });
});

describe('writeFile3Import (synthetic)', () => {
  it('attaches letter to existing Kootaj and reviews unmatched / extraction failed', async () => {
    const file1Wb: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '810001',
            'شرح کالا': 'کالا',
            'وزن ناخالص': '1',
            'نام صاحب کالا': 'مالک',
          },
        ],
      },
      filePath: 'phase6-file1.xlsx',
    };

    const file1 = await writeFile1Import({
      db,
      filePath: file1Wb.filePath!,
      workbook: file1Wb,
    });
    createdBatchIds.push(file1.batchId);

    const file3Wb: Workbook = {
      sheetNames: ['auto'],
      sheets: {
        auto: [
          {
            توضیحات: 'شماره کوتاژ 810001',
            'شماره ثبت': '1405/200',
            'تاریخ ثبت': '1405/02/01',
            'شناسه نامه': 'A1',
          },
          {
            توضیحات: 'شماره کوتاژ 810001',
            'شماره ثبت': '',
            'تاریخ ثبت': '',
            'شناسه نامه': 'A2',
          },
          {
            توضیحات: 'شماره کوتاژ 899999',
            'شماره ثبت': '1405/201',
            'تاریخ ثبت': '1405/02/02',
            'شناسه نامه': 'A3',
          },
          {
            توضیحات: 'بدون کوتاژ',
            'شماره ثبت': '1405/202',
            'تاریخ ثبت': '1405/02/03',
            'شناسه نامه': 'A4',
          },
        ],
      },
      filePath: 'phase6-file3.xlsx',
    };

    const result = await writeFile3Import({
      db,
      filePath: file3Wb.filePath!,
      workbook: file3Wb,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, 0);
    assert.equal(result.lettersAttached, 1);
    assert.equal(result.status, 'COMPLETED_WITH_REVIEW');
    assert.ok(result.reviewCreated >= 2);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 1);
    assert.equal(batchLetters[0].letterNumber, '1405/200');

    const parentsCreatedByFile3 = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parentsCreatedByFile3.length, 0);

    const reviews = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.importBatchId, result.batchId));
    assert.ok(reviews.some((r) => r.type === 'UNMATCHED'));
    assert.ok(reviews.some((r) => r.type === 'EXTRACTION_FAILED'));

    const drafts = await db
      .select()
      .from(importRows)
      .where(
        sql`${importRows.importBatchId} = ${result.batchId} AND ${importRows.disposition} = 'LETTER_DRAFT_IGNORED'`,
      );
    assert.equal(drafts.length, 1);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.importBatchId, result.batchId));
    assert.equal(audits.filter((a) => a.action === 'LETTER_ATTACHED').length, 1);
    assert.ok(audits.some((a) => a.action === 'IMPORT_COMPLETED'));
  });

  it('idempotent re-import SKIPs same letter; different letter → CONFLICT', async () => {
    const file1Wb: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '820001',
            'شرح کالا': 'کالا',
            'وزن ناخالص': '1',
          },
        ],
      },
      filePath: 'phase6-idem-file1.xlsx',
    };
    const file1 = await writeFile1Import({
      db,
      filePath: file1Wb.filePath!,
      workbook: file1Wb,
    });
    createdBatchIds.push(file1.batchId);

    const sameLetterWb: Workbook = {
      sheetNames: ['auto'],
      sheets: {
        auto: [
          {
            توضیحات: 'شماره کوتاژ 820001',
            'شماره ثبت': '1405/300',
            'تاریخ ثبت': '1405/03/01',
            'شناسه نامه': 'B1',
          },
        ],
      },
      filePath: 'phase6-idem-file3a.xlsx',
    };

    const first = await writeFile3Import({
      db,
      filePath: sameLetterWb.filePath!,
      workbook: sameLetterWb,
    });
    createdBatchIds.push(first.batchId);
    assert.equal(first.lettersAttached, 1);

    const second = await writeFile3Import({
      db,
      filePath: sameLetterWb.filePath!,
      workbook: sameLetterWb,
    });
    createdBatchIds.push(second.batchId);
    assert.equal(second.lettersAttached, 0);
    assert.equal(second.counters.skippedRecords, 1);

    const conflictWb: Workbook = {
      sheetNames: ['auto'],
      sheets: {
        auto: [
          {
            توضیحات: 'شماره کوتاژ 820001',
            'شماره ثبت': '1405/399',
            'تاریخ ثبت': '1405/03/02',
            'شناسه نامه': 'B2',
          },
        ],
      },
      filePath: 'phase6-conflict-file3.xlsx',
    };

    const third = await writeFile3Import({
      db,
      filePath: conflictWb.filePath!,
      workbook: conflictWb,
    });
    createdBatchIds.push(third.batchId);
    assert.equal(third.lettersAttached, 0);
    assert.equal(third.reviewCreated, 1);
    assert.equal(third.status, 'COMPLETED_WITH_REVIEW');

    const reviews = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.importBatchId, third.batchId));
    assert.equal(reviews[0].type, 'LETTER_CONFLICT');

    const allLetters = await db
      .select()
      .from(letters)
      .innerJoin(kootajs, eq(letters.kootajId, kootajs.id))
      .where(eq(kootajs.normalizedKootaj, '820001'));
    assert.equal(allLetters.length, 1);
    assert.equal(allLetters[0].letters.letterNumber, '1405/300');
  });

  it('in-file multi-letter CONFLICT does not attach', async () => {
    const file1Wb: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '830001',
            'شرح کالا': 'کالا',
            'وزن ناخالص': '1',
          },
        ],
      },
      filePath: 'phase6-multi-file1.xlsx',
    };
    const file1 = await writeFile1Import({
      db,
      filePath: file1Wb.filePath!,
      workbook: file1Wb,
    });
    createdBatchIds.push(file1.batchId);

    const file3Wb: Workbook = {
      sheetNames: ['auto'],
      sheets: {
        auto: [
          {
            توضیحات: 'شماره کوتاژ 830001',
            'شماره ثبت': '1405/401',
            'تاریخ ثبت': '1405/04/01',
            'شناسه نامه': 'C1',
          },
          {
            توضیحات: 'شماره کوتاژ 830001',
            'شماره ثبت': '1405/402',
            'تاریخ ثبت': '1405/04/02',
            'شناسه نامه': 'C2',
          },
        ],
      },
      filePath: 'phase6-multi-file3.xlsx',
    };

    const result = await writeFile3Import({
      db,
      filePath: file3Wb.filePath!,
      workbook: file3Wb,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.lettersAttached, 0);
    assert.equal(result.reviewCreated, 1);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 0);

    const reviews = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.importBatchId, result.batchId));
    assert.equal(reviews[0].type, 'LETTER_CONFLICT');
  });
});

describe('writeFile3Import (real Excel)', () => {
  it('attaches letters after File1+File2 and never creates Kootajs', async (t) => {
    if (!canDiscoverSourceFiles()) {
      t.skip('Amar source files not discoverable');
      return;
    }

    const paths = resolveSourcePaths([]);

    // Clean prior domain rows from earlier runs
    const prior = await db
      .select({ id: kootajs.id, batchId: kootajs.createdImportBatchId })
      .from(kootajs);
    const priorBatches = [
      ...new Set(prior.map((r) => r.batchId).filter((id): id is string => id != null)),
    ];
    // Also clean letter-only batches
    const letterBatches = await db
      .select({ id: letters.importBatchId })
      .from(letters)
      .where(sql`${letters.importBatchId} IS NOT NULL`);
    for (const b of letterBatches) {
      if (b.id && !priorBatches.includes(b.id)) priorBatches.push(b.id);
    }
    for (const batchId of priorBatches) {
      if (!createdBatchIds.includes(batchId)) createdBatchIds.push(batchId);
      await cleanupBatch(batchId);
    }

    const file1 = await writeFile1Import({ db, filePath: paths.file1 });
    createdBatchIds.push(file1.batchId);
    assert.equal(file1.kootajCreated, PRIOR_ANALYSIS_EXPECTATIONS.file1_unique_kootajs);

    const file2 = await writeFile2Import({ db, filePath: paths.file2 });
    createdBatchIds.push(file2.batchId);
    assert.equal(file2.kootajCreated, PRIOR_ANALYSIS_EXPECTATIONS.file2_new_kootajs);

    const wb1 = readWorkbook(paths.file1);
    const wb2 = readWorkbook(paths.file2);
    const wb3 = readWorkbook(paths.file3);
    const f1 = processFile1(wb1);
    const f2 = processFile2(wb2, f1.kootajSet);
    const unified = buildUnifiedSet(f1, f2);
    const plan = planFile3DryRun(wb3, unified);
    const analysis = processFile3(wb3, unified);

    const result = await writeFile3Import({ db, filePath: paths.file3 });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, 0);
    assert.equal(result.lettersAttached, plan.counters.createdRecords);
    assert.equal(result.counters.totalRows, PRIOR_ANALYSIS_EXPECTATIONS.file3_physical_rows);
    assert.equal(result.counters.createdRecords, plan.counters.createdRecords);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, plan.counters.createdRecords);

    const parentsFromFile3 = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parentsFromFile3.length, 0);

    // Every attached letter must point at an existing Kootaj
    for (const letter of batchLetters) {
      const [parent] = await db.select().from(kootajs).where(eq(kootajs.id, letter.kootajId));
      assert.ok(parent);
    }

    assert.equal(analysis.physical_rows, PRIOR_ANALYSIS_EXPECTATIONS.file3_physical_rows);
    assert.equal(
      analysis.rows_with_registration_number,
      PRIOR_ANALYSIS_EXPECTATIONS.file3_rows_with_registration,
    );
  });
});
