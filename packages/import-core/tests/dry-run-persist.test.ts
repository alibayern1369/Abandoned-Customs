/**
 * Phase 3 dry-run persistence against PostgreSQL.
 * Asserts import_batches + import_rows are written and this batch creates no domain rows.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { createDb, importBatches, importRows, kootajs, kootajItems, letters, reviewItems } from '@metrookeh/db';
import {
  canDiscoverSourceFiles,
  persistDryRun,
  planFile1DryRun,
  resolveSourcePaths,
  runFullDryRunImport,
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
    await db.delete(importBatches).where(eq(importBatches.id, id));
  }
  await client.end();
});

/** Domain rows linked to this batch must stay empty for dry-run. */
async function assertNoDomainForBatch(batchId: string) {
  const parents = await db.select().from(kootajs).where(eq(kootajs.createdImportBatchId, batchId));
  const items = await db.select().from(kootajItems).where(eq(kootajItems.importBatchId, batchId));
  const reviews = await db.select().from(reviewItems).where(eq(reviewItems.importBatchId, batchId));
  const batchLetters = await db.select().from(letters).where(eq(letters.importBatchId, batchId));
  assert.equal(parents.length, 0);
  assert.equal(items.length, 0);
  assert.equal(reviews.length, 0);
  assert.equal(batchLetters.length, 0);
}

describe('persistDryRun', () => {
  it('writes batch + rows and does not create domain rows for the batch', async () => {
    const workbook: Workbook = {
      sheetNames: ['متروکه کلی'],
      sheets: {
        'متروکه کلی': [
          { 'شماره کوتاژ': '900001', 'شرح کالا': 'X', 'وزن ناخالص': '1' },
          { 'شماره کوتاژ': '900001', 'شرح کالا': 'Y', 'وزن ناخالص': '2' },
          { 'شماره کوتاژ': '', 'شرح کالا': 'Z', 'وزن ناخالص': '3' },
        ],
      },
      filePath: 'dry-run-test-file1.xlsx',
    };

    const plan = planFile1DryRun(workbook);
    const result = await persistDryRun({ db, plan });
    createdBatchIds.push(result.batchId);

    assert.equal(result.rowCount, 3);
    assert.equal(result.counters.createdRecords, 1);
    assert.equal(result.counters.skippedRecords, 1);
    assert.equal(result.status, 'COMPLETED');

    const [batch] = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, result.batchId));
    assert.equal(batch.fileType, 'FILE1');
    assert.equal(batch.fileName, 'dry-run-test-file1.xlsx');
    assert.equal(batch.totalRows, 3);
    assert.ok(batch.completedAt);

    const rows = await db
      .select()
      .from(importRows)
      .where(eq(importRows.importBatchId, result.batchId));
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.rawPayload && typeof r.rawPayload === 'object'));
    assert.ok(rows.some((r) => r.disposition === 'CREATED_KOOTAJ'));
    assert.ok(rows.some((r) => r.disposition === 'CREATED_ITEM'));
    assert.ok(rows.some((r) => r.disposition === 'IGNORED_EMPTY_KEY'));

    await assertNoDomainForBatch(result.batchId);
  });
});

describe('runFullDryRunImport (real Excel)', () => {
  it('persists three batches with count locks and no domain rows for those batches', async (t) => {
    if (!canDiscoverSourceFiles()) {
      t.skip('Amar source files not discoverable');
      return;
    }

    const paths = resolveSourcePaths([]);

    const result = await runFullDryRunImport({
      db,
      file1Path: paths.file1,
      file2Path: paths.file2,
      file3Path: paths.file3,
    });

    createdBatchIds.push(result.file1.batchId, result.file2.batchId, result.file3.batchId);

    assert.equal(result.domainWrites, false);
    assert.equal(result.file1.counters.createdRecords, 598);
    assert.equal(result.file1.counters.totalRows, 624);
    assert.equal(result.file2.plan.summary.existing_kootajs, 526);
    assert.equal(result.file2.plan.summary.new_kootajs, 50);
    assert.equal(result.file2.counters.createdRecords, 50);
    assert.equal(result.file3.counters.totalRows, 86);

    const f1Rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(importRows)
      .where(eq(importRows.importBatchId, result.file1.batchId));
    assert.equal(f1Rows[0].n, 624);

    const f2Skipped = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(importRows)
      .where(
        sql`${importRows.importBatchId} = ${result.file2.batchId} AND ${importRows.disposition} = 'SKIPPED_EXISTING'`,
      );
    assert.equal(f2Skipped[0].n, 554);

    await assertNoDomainForBatch(result.file1.batchId);
    await assertNoDomainForBatch(result.file2.batchId);
    await assertNoDomainForBatch(result.file3.batchId);
  });
});
