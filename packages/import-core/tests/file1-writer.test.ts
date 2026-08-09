/**
 * Phase 4 — File1 domain writer tests.
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
  writeFile1Import,
  mapFile1Kootaj,
  getImportCoreReadiness,
  processFile1,
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
  for (const id of createdBatchIds) {
    await cleanupFile1Batch(id);
  }
  await client.end();
});

async function cleanupFile1Batch(batchId: string) {
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
  // audit_logs are append-only; disable trigger only for test teardown
  await db.execute(sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`);
  try {
    await db.execute(sql`DELETE FROM audit_logs WHERE import_batch_id = ${batchId}`);
    await db.delete(importBatches).where(eq(importBatches.id, batchId));
  } finally {
    await db.execute(sql`ALTER TABLE audit_logs ENABLE TRIGGER ALL`);
  }
}

describe('Phase 6 readiness', () => {
  it('reports File1 + File2 + File3 writers', () => {
    const r = getImportCoreReadiness();
    assert.equal(r.phase, 6);
    assert.equal(r.file1WriterImplemented, true);
    assert.equal(r.file2WriterImplemented, true);
    assert.equal(r.file3WriterImplemented, true);
    assert.equal(r.domainWritesImplemented, true);
  });
});

describe('mapFile1Kootaj', () => {
  it('maps parent fields and never invents SUM totals', () => {
    const analysis = processFile1({
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '800001',
            'تاریخ کوتاژ': '1403/01/01',
            'ارزش ریالی کالا': '1000',
            'محل ارزیابی': 'کیش',
            'وضعیت کالا': 'متروکه',
            'شرح کالا': 'A',
            'کد تعرفه': '1234',
            'وزن ناخالص': '10',
            'شماره قبض انبار': 'W1',
          },
          {
            'شماره کوتاژ': '800001',
            'تاریخ کوتاژ': '1403/01/01',
            'ارزش ریالی کالا': '1000',
            'محل ارزیابی': 'کیش',
            'وضعیت کالا': 'متروکه',
            'شرح کالا': 'B',
            'کد تعرفه': '5678',
            'وزن ناخالص': '5',
            'شماره قبض انبار': 'W2',
          },
        ],
      },
    });

    const mapped = mapFile1Kootaj(analysis.kootajs[0]);
    assert.equal(mapped.sourceOrigin, 'FILE1');
    assert.equal(mapped.normalizedKootaj, '800001');
    assert.equal(mapped.rialValue, '1000');
    assert.equal(mapped.assessmentLocation, 'کیش');
    assert.equal(mapped.hasParentFieldConflict, false);
  });
});

describe('writeFile1Import (synthetic)', () => {
  it('creates kootajs, items, import provenance, and audit — no letters', async () => {
    const workbook: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '810001',
            'تاریخ کوتاژ': '1403/02/01',
            'ارزش ریالی کالا': '500',
            'محل ارزیابی': 'کیش',
            'مرحله اظهارنامه': 'قطعى',
            'وضعیت کالا': 'متروکه',
            'شرح کالا': 'کالای الف',
            'کد تعرفه': '1111',
            'وزن ناخالص': '2',
            'شماره قبض انبار': 'R1',
            ردیف: '1',
          },
          {
            'شماره کوتاژ': '810001',
            'تاریخ کوتاژ': '1403/02/01',
            'ارزش ریالی کالا': '500',
            'محل ارزیابی': 'کیش',
            'مرحله اظهارنامه': 'قطعى',
            'وضعیت کالا': 'متروکه',
            'شرح کالا': 'کالای ب',
            'کد تعرفه': '2222',
            'وزن ناخالص': '3',
            'شماره قبض انبار': 'R2',
            ردیف: '2',
          },
          {
            'شماره کوتاژ': '810002',
            'تاریخ کوتاژ': '1403/02/02',
            'ارزش ریالی کالا': '900',
            'محل ارزیابی': 'کیش',
            'وضعیت کالا': 'متروکه',
            'شرح کالا': 'کالای ج',
            'کد تعرفه': '3333',
            'وزن ناخالص': '1',
            'شماره قبض انبار': 'R3',
          },
          {
            'شماره کوتاژ': '',
            'شرح کالا': 'بدون کلید',
          },
        ],
      },
      filePath: 'phase4-synthetic-file1.xlsx',
    };

    const result = await writeFile1Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.domainWrites, true);
    assert.equal(result.kootajCreated, 2);
    assert.equal(result.itemsCreated, 3);
    assert.equal(result.counters.skippedRecords, 1);
    assert.equal(result.status, 'COMPLETED');

    const parents = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parents.length, 2);
    assert.ok(parents.every((p) => p.sourceOrigin === 'FILE1'));

    const items = await db
      .select()
      .from(kootajItems)
      .where(eq(kootajItems.importBatchId, result.batchId));
    assert.equal(items.length, 3);
    assert.ok(items.every((i) => i.sourceFileType === 'FILE1'));
    assert.ok(items.every((i) => i.importRowId != null));

    const rows = await db
      .select()
      .from(importRows)
      .where(eq(importRows.importBatchId, result.batchId));
    assert.equal(rows.length, 4);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.importBatchId, result.batchId));
    assert.ok(audits.some((a) => a.action === 'KOOTAJ_CREATED'));
    assert.ok(audits.some((a) => a.action === 'IMPORT_COMPLETED'));
    assert.equal(audits.filter((a) => a.action === 'KOOTAJ_CREATED').length, 2);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 0);
  });

  it('creates PARENT_FIELD_CONFLICT review when parent fields disagree', async () => {
    const workbook: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '820001',
            'محل ارزیابی': 'کیش',
            'ارزش ریالی کالا': '100',
            'شرح کالا': 'A',
            'وزن ناخالص': '1',
          },
          {
            'شماره کوتاژ': '820001',
            'محل ارزیابی': 'بندرعباس',
            'ارزش ریالی کالا': '100',
            'شرح کالا': 'B',
            'وزن ناخالص': '2',
          },
        ],
      },
      filePath: 'phase4-conflict-file1.xlsx',
    };

    const result = await writeFile1Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, 1);
    assert.equal(result.itemsCreated, 2);
    assert.equal(result.reviewCreated, 1);
    assert.equal(result.status, 'COMPLETED_WITH_REVIEW');

    const reviews = await db
      .select()
      .from(reviewItems)
      .where(eq(reviewItems.importBatchId, result.batchId));
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].type, 'PARENT_FIELD_CONFLICT');
    assert.equal(reviews[0].status, 'OPEN');

    const [parent] = await db
      .select()
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parent.hasParentFieldConflict, true);
    assert.equal(parent.assessmentLocation, 'کیش'); // FIRST kept

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.importBatchId, result.batchId));
    assert.ok(audits.some((a) => a.action === 'CONFLICT_DETECTED'));
  });

  it('rolls back entirely when normalized_kootaj already exists', async () => {
    const workbook: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          {
            'شماره کوتاژ': '830001',
            'شرح کالا': 'once',
            'وزن ناخالص': '1',
          },
        ],
      },
      filePath: 'phase4-dup-file1.xlsx',
    };

    const first = await writeFile1Import({
      db,
      filePath: workbook.filePath!,
      workbook,
    });
    createdBatchIds.push(first.batchId);

    const beforeBatches = await db.select({ n: sql<number>`count(*)::int` }).from(importBatches);

    await assert.rejects(
      () =>
        writeFile1Import({
          db,
          filePath: workbook.filePath!,
          workbook,
        }),
      /File1 import failed/,
    );

    const afterBatches = await db.select({ n: sql<number>`count(*)::int` }).from(importBatches);
    assert.equal(afterBatches[0].n, beforeBatches[0].n);

    const parents = await db.select().from(kootajs).where(eq(kootajs.normalizedKootaj, '830001'));
    assert.equal(parents.length, 1);
  });
});

describe('writeFile1Import (real Excel)', () => {
  it('seeds 598 kootajs and 624 items from Amar File1', async (t) => {
    if (!canDiscoverSourceFiles()) {
      t.skip('Amar source files not discoverable');
      return;
    }

    const paths = resolveSourcePaths([]);

    // Ensure a clean slate for File1 identities from this Amar set — delete prior Phase4 seed if any
    // by normalized keys would be heavy; instead skip if any FILE1 kootaj already present from same path basename.
    const existingFile1 = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(kootajs)
      .where(eq(kootajs.sourceOrigin, 'FILE1'));
    if (existingFile1[0].n > 0) {
      // Clean all FILE1 parents created by previous test runs (items first)
      const file1Ids = await db
        .select({ id: kootajs.id, batchId: kootajs.createdImportBatchId })
        .from(kootajs)
        .where(eq(kootajs.sourceOrigin, 'FILE1'));
      const batchIds = [
        ...new Set(file1Ids.map((r) => r.batchId).filter((id): id is string => id != null)),
      ];
      for (const batchId of batchIds) {
        if (!createdBatchIds.includes(batchId)) createdBatchIds.push(batchId);
        await cleanupFile1Batch(batchId);
      }
    }

    const result = await writeFile1Import({
      db,
      filePath: paths.file1,
    });
    createdBatchIds.push(result.batchId);

    assert.equal(result.kootajCreated, 598);
    assert.equal(result.itemsCreated, 624);
    assert.equal(result.counters.totalRows, 624);
    assert.equal(result.counters.createdRecords, 598);

    const parentCount = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(kootajs)
      .where(eq(kootajs.createdImportBatchId, result.batchId));
    assert.equal(parentCount[0].n, 598);

    const itemCount = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(kootajItems)
      .where(eq(kootajItems.importBatchId, result.batchId));
    assert.equal(itemCount[0].n, 624);

    const multiGroups = await db
      .select({
        kootajId: kootajItems.kootajId,
        n: sql<number>`count(*)::int`,
      })
      .from(kootajItems)
      .where(eq(kootajItems.importBatchId, result.batchId))
      .groupBy(kootajItems.kootajId)
      .having(sql`count(*) > 1`);
    assert.ok(multiGroups.length >= 1);

    const batchLetters = await db
      .select()
      .from(letters)
      .where(eq(letters.importBatchId, result.batchId));
    assert.equal(batchLetters.length, 0);
  });
});
