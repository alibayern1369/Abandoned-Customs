/**
 * Phase 5 — File2 domain writer tests.
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
  mapFile2Kootaj,
  processFile1,
  processFile2,
  getImportCoreReadiness,
  decideFile2Action,
  PRIOR_ANALYSIS_EXPECTATIONS,
  type Workbook,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.example') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';

const FILE2_KOOTAJ_COL = 'شماره مجوز بارگيري';

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

describe('Phase 6 readiness (file2)', () => {
  it('marks File2 writer implemented under Phase 6', () => {
    const r = getImportCoreReadiness();
    assert.equal(r.phase, 6);
    assert.equal(r.file2WriterImplemented, true);
    assert.equal(r.file3WriterImplemented, true);
    assert.equal(decideFile2Action(true), 'SKIP');
    assert.equal(decideFile2Action(false), 'CREATE');
  });
});

describe('mapFile2Kootaj', () => {
  it('maps File2 parent fields with source_origin FILE2', () => {
    const analysis = processFile2(
      {
        sheetNames: ['sheet'],
        sheets: {
          sheet: [
            {
              [FILE2_KOOTAJ_COL]: '900001',
              'زمان کوتاژ': '1403/03/01',
              'نام صاحب کالا': 'مالک الف',
              'ارزش ریالی اظهارنامه': '2000',
              'نام کالا': 'کالا',
              'وزن ناخالص': '4',
            },
          ],
        },
      },
      new Set(),
    );

    const mapped = mapFile2Kootaj(analysis.new[0]);
    assert.equal(mapped.sourceOrigin, 'FILE2');
    assert.equal(mapped.normalizedKootaj, '900001');
    assert.equal(mapped.ownerName, 'مالک الف');
    assert.equal(mapped.rialValue, '2000');
    assert.equal(mapped.kootajDate, '1403/03/01');
  });
});

describe('writeFile2Import (synthetic)', () => {
  it('SKIPs existing and CREATEs only NEW — no overwrite of File1', async () => {
    const file1Wb: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '910001',
            'محل ارزیابی': 'کیش',
            'ارزش ریالی کالا': '100',
            'شرح کالا': 'از فایل۱',
            'وزن ناخالص': '1',
          },
        ],
      },
      filePath: 'phase5-file1-seed.xlsx',
    };

    const file1 = await writeFile1Import({
      db,
      filePath: file1Wb.filePath!,
      workbook: file1Wb,
    });
    createdBatchIds.push(file1.batchId);

    const file2Wb: Workbook = {
      sheetNames: ['f2'],
      sheets: {
        f2: [
          {
            [FILE2_KOOTAJ_COL]: '910001',
            'نام صاحب کالا': 'نباید ذخیره شود',
            'نام کالا': 'رد شده',
            'وزن ناخالص': '99',
          },
          {
            [FILE2_KOOTAJ_COL]: '910002',
            'زمان کوتاژ': '1403/04/01',
            'نام صاحب کالا': 'مالک جدید',
            'ارزش ریالی اظهارنامه': '500',
            'نام کالا': 'کالای جدید الف',
            'کد اچ اس کالا': '1111',
            'وزن ناخالص': '2',
            'وزن خالص': '1.5',
            'تعداد بسته': '3',
            'شماره قبض انبار': 'W-NEW',
          },
          {
            [FILE2_KOOTAJ_COL]: '910002',
            'زمان کوتاژ': '1403/04/01',
            'نام صاحب کالا': 'مالک جدید',
            'ارزش ریالی اظهارنامه': '500',
            'نام کالا': 'کالای جدید ب',
            'کد اچ اس کالا': '2222',
            'وزن ناخالص': '3',
            'شماره قبض انبار': 'W-NEW-2',
          },
          {
            [FILE2_KOOTAJ_COL]: '',
            'نام کالا': 'بدون کلید',
          },
        ],
      },
      filePath: 'phase5-synthetic-file2.xlsx',
    };

    const result = await writeFile2Import({
      db,
      filePath: file2Wb.filePath!,
      workbook: file2Wb,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.domainWrites, true);
    assert.equal(result.fileType, 'FILE2');
    assert.equal(result.kootajCreated, 1);
    assert.equal(result.kootajSkipped, 1);
    assert.equal(result.itemsCreated, 2);
    assert.equal(result.counters.skippedRecords, 2); // 1 EXISTING + 1 empty key
    assert.equal(result.status, 'COMPLETED');

    const [file1Parent] = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.normalizedKootaj, '910001'));
    assert.equal(file1Parent.sourceOrigin, 'FILE1');
    assert.equal(file1Parent.assessmentLocation, 'کیش');
    assert.notEqual(file1Parent.ownerName, 'نباید ذخیره شود');

    const [file2Parent] = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.normalizedKootaj, '910002'));
    assert.equal(file2Parent.sourceOrigin, 'FILE2');
    assert.equal(file2Parent.ownerName, 'مالک جدید');
    assert.equal(file2Parent.rialValue, '500.0000');

    const file2Items = await db
      .select()
      .from(kootajItems)
      .where(eq(kootajItems.importBatchId, result.batchId));
    assert.equal(file2Items.length, 2);
    assert.ok(file2Items.every((i) => i.sourceFileType === 'FILE2'));

    const skippedRows = await db
      .select()
      .from(importRows)
      .where(
        sql`${importRows.importBatchId} = ${result.batchId} AND ${importRows.disposition} = 'SKIPPED_EXISTING'`,
      );
    assert.equal(skippedRows.length, 1);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.importBatchId, result.batchId));
    assert.equal(audits.filter((a) => a.action === 'KOOTAJ_CREATED').length, 1);
    assert.ok(audits.some((a) => a.action === 'IMPORT_COMPLETED'));

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 0);
  });

  it('creates PARENT_FIELD_CONFLICT review for NEW File2 conflicts', async () => {
    const workbook: Workbook = {
      sheetNames: ['f2'],
      sheets: {
        f2: [
          {
            [FILE2_KOOTAJ_COL]: '920001',
            'نام صاحب کالا': 'مالک ۱',
            'نام کالا': 'A',
            'وزن ناخالص': '1',
          },
          {
            [FILE2_KOOTAJ_COL]: '920001',
            'نام صاحب کالا': 'مالک ۲',
            'نام کالا': 'B',
            'وزن ناخالص': '2',
          },
        ],
      },
      filePath: 'phase5-conflict-file2.xlsx',
    };

    const result = await writeFile2Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, 1);
    assert.equal(result.itemsCreated, 2);
    assert.equal(result.reviewCreated, 1);
    assert.equal(result.status, 'COMPLETED_WITH_REVIEW');

    const [parent] = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parent.hasParentFieldConflict, true);
    assert.equal(parent.ownerName, 'مالک ۱'); // FIRST kept

    const reviews = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.importBatchId, result.batchId));
    assert.equal(reviews[0].type, 'PARENT_FIELD_CONFLICT');
  });

  it('second File2 import SKIPs previously created File2 Kootajs', async () => {
    const workbook: Workbook = {
      sheetNames: ['f2'],
      sheets: {
        f2: [
          {
            [FILE2_KOOTAJ_COL]: '930001',
            'نام صاحب کالا': 'اول',
            'نام کالا': 'X',
            'وزن ناخالص': '1',
          },
        ],
      },
      filePath: 'phase5-rerun-file2.xlsx',
    };

    const first = await writeFile2Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(first.batchId);
    assert.equal(first.kootajCreated, 1);

    const second = await writeFile2Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(second.batchId);

    assert.equal(second.kootajCreated, 0);
    assert.equal(second.kootajSkipped, 1);
    assert.equal(second.itemsCreated, 0);
    assert.equal(second.counters.skippedRecords, 1);

    const parents = await db.select().from(kootajs).where(eq(kootajs.normalizedKootaj, '930001'));
    assert.equal(parents.length, 1);
    assert.equal(parents[0].ownerName, 'اول');
  });
});

describe('writeFile2Import (real Excel)', () => {
  it('creates 50 NEW File2 kootajs and skips 554 existing rows after File1', async (t) => {
    if (!canDiscoverSourceFiles()) {
      t.skip('Amar source files not discoverable');
      return;
    }

    const paths = resolveSourcePaths([]);

    // Clean prior FILE1/FILE2 domain rows from earlier runs
    const prior = await db
      .select({ id: kootajs.id, batchId: kootajs.createdImportBatchId })
      .from(kootajs);
    const priorBatches = [
      ...new Set(prior.map((r) => r.batchId).filter((id): id is string => id != null)),
    ];
    for (const batchId of priorBatches) {
      if (!createdBatchIds.includes(batchId)) createdBatchIds.push(batchId);
      await cleanupBatch(batchId);
    }

    const file1 = await writeFile1Import({ db, filePath: paths.file1 });
    createdBatchIds.push(file1.batchId);
    assert.equal(file1.kootajCreated, PRIOR_ANALYSIS_EXPECTATIONS.file1_unique_kootajs);

    const file1Set = processFile1(readWorkbook(paths.file1)).kootajSet;
    const analysis = processFile2(readWorkbook(paths.file2), file1Set);

    const result = await writeFile2Import({ db, filePath: paths.file2 });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, PRIOR_ANALYSIS_EXPECTATIONS.file2_new_kootajs);
    assert.equal(result.kootajSkipped, PRIOR_ANALYSIS_EXPECTATIONS.file2_existing_kootajs);
    assert.equal(result.itemsCreated, analysis.new_rows);
    assert.equal(
      result.counters.skippedRecords,
      PRIOR_ANALYSIS_EXPECTATIONS.file2_existing_rows + analysis.empty_key_rows,
    );

    const file2Parents = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(file2Parents[0].n, 50);
    assert.ok(
      (
        await db
          .select()
          .from(kootajs)
          .where(eq(kootajs.createdImportBatchId, result.batchId))
      ).every((p) => p.sourceOrigin === 'FILE2'),
    );

    const skipped = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(importRows)
      .where(
        sql`${importRows.importBatchId} = ${result.batchId} AND ${importRows.disposition} = 'SKIPPED_EXISTING'`,
      );
    assert.equal(skipped[0].n, PRIOR_ANALYSIS_EXPECTATIONS.file2_existing_rows);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 0);
  });
});
