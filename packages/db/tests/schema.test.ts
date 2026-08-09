import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { users } from '../src/schema/users.js';
import { importBatches } from '../src/schema/import-batches.js';
import { kootajs } from '../src/schema/kootajs.js';
import { kootajItems } from '../src/schema/kootaj-items.js';
import { letters } from '../src/schema/letters.js';
import { importRows } from '../src/schema/import-rows.js';
import { reviewItems } from '../src/schema/review-items.js';
import { auditLogs } from '../src/schema/audit-logs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
config({ path: path.join(repoRoot, '.env') });
config({ path: path.join(repoRoot, '.env.example') });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://metrookeh:metrookeh@localhost:5432/metrookeh';

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  while (current && typeof current === 'object') {
    if ('code' in current && typeof (current as { code: unknown }).code === 'string') {
      const code = (current as { code: string }).code;
      // Prefer Postgres SQLSTATE (5-char alphanumeric) over Node assert codes
      if (/^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = 'cause' in current ? (current as { cause: unknown }).cause : undefined;
  }
  return undefined;
}

async function expectReject(fn: () => Promise<unknown>, code?: string) {
  await assert.rejects(fn, (err: unknown) => {
    if (!code) return true;
    return pgErrorCode(err) === code;
  });
}

before(async () => {
  client = postgres(databaseUrl, { max: 1 });
  db = drizzle(client);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../src/migrations'),
  });
});

after(async () => {
  await client.end();
});

describe('schema tables exist', () => {
  it('creates all eight Phase 1 tables', async () => {
    const rows = await client<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'users', 'kootajs', 'kootaj_items', 'letters',
          'import_batches', 'import_rows', 'review_items', 'audit_logs'
        )
      ORDER BY table_name
    `;
    assert.deepEqual(
      rows.map((r) => r.table_name),
      [
        'audit_logs',
        'import_batches',
        'import_rows',
        'kootaj_items',
        'kootajs',
        'letters',
        'review_items',
        'users',
      ],
    );
  });

  it('does not create warehouse_receipts', async () => {
    const rows = await client<{ n: string }[]>`
      SELECT table_name AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'warehouse_receipts'
    `;
    assert.equal(rows.length, 0);
  });
});

describe('constraints and relationships', () => {
  it('enforces UNIQUE(normalized_kootaj)', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 't.xlsx', fileType: 'FILE1', status: 'RUNNING' })
      .returning();

    await db.insert(kootajs).values({
      normalizedKootaj: `uniq-${batch.id}`,
      displayKootaj: 'uniq',
      sourceOrigin: 'FILE1',
      createdImportBatchId: batch.id,
    });

    await expectReject(
      () =>
        db.insert(kootajs).values({
          normalizedKootaj: `uniq-${batch.id}`,
          displayKootaj: 'dup',
          sourceOrigin: 'FILE2',
          createdImportBatchId: batch.id,
        }),
      '23505',
    );
  });

  it('enforces UNIQUE(letters.kootaj_id) — 0:1 letter', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 'letters.xlsx', fileType: 'FILE3', status: 'RUNNING' })
      .returning();

    const [k] = await db
      .insert(kootajs)
      .values({
        normalizedKootaj: `letter-${batch.id}`,
        sourceOrigin: 'FILE1',
        createdImportBatchId: batch.id,
      })
      .returning();

    await db.insert(letters).values({
      kootajId: k.id,
      letterNumber: '1405/1',
      description: 'first',
      importBatchId: batch.id,
    });

    await expectReject(
      () =>
        db.insert(letters).values({
          kootajId: k.id,
          letterNumber: '1405/2',
          description: 'second',
          importBatchId: batch.id,
        }),
      '23505',
    );
  });

  it('restricts deleting Kootaj that still has items', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 'items.xlsx', fileType: 'FILE1', status: 'COMPLETED' })
      .returning();

    const [k] = await db
      .insert(kootajs)
      .values({
        normalizedKootaj: `items-${batch.id}`,
        sourceOrigin: 'FILE1',
        createdImportBatchId: batch.id,
      })
      .returning();

    await db.insert(kootajItems).values({
      kootajId: k.id,
      goodsDescription: 'کالا',
      tariffCode: '1234',
      warehouseReceiptNo: 'WR-1',
      sourceFileType: 'FILE1',
      sourceRowNumber: 2,
      importBatchId: batch.id,
    });

    await expectReject(() => db.delete(kootajs).where(sql`${kootajs.id} = ${k.id}`), '23503');
  });

  it('links import_rows to import_batches and stores raw_payload', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 'rows.xlsx', fileType: 'FILE2', status: 'RUNNING' })
      .returning();

    const [row] = await db
      .insert(importRows)
      .values({
        importBatchId: batch.id,
        sourceRowNumber: 2,
        rawPayload: { 'شماره مجوز بارگيري': '208856', 'نام کالا': 'تست' },
        normalizedKootaj: '208856',
        processingStatus: 'PROCESSED',
        disposition: 'CREATED_KOOTAJ',
      })
      .returning();

    assert.equal(row.importBatchId, batch.id);
    assert.equal((row.rawPayload as { 'نام کالا': string })['نام کالا'], 'تست');
  });

  it('supports review_items types and OPEN status', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 'review.xlsx', fileType: 'FILE3', status: 'COMPLETED_WITH_REVIEW' })
      .returning();

    const [item] = await db
      .insert(reviewItems)
      .values({
        type: 'LETTER_CONFLICT',
        status: 'OPEN',
        importBatchId: batch.id,
        payload: { candidates: ['1405/1', '1405/2'] },
      })
      .returning();

    assert.equal(item.type, 'LETTER_CONFLICT');
    assert.equal(item.status, 'OPEN');
  });

  it('blocks UPDATE and DELETE on audit_logs', async () => {
    const [log] = await db
      .insert(auditLogs)
      .values({
        action: 'IMPORT_STARTED',
        entityType: 'import_batch',
        entityId: 'test',
        metadata: { phase: 1 },
      })
      .returning();

    await expectReject(
      () =>
        client`
          UPDATE audit_logs SET action = 'TAMPERED' WHERE id = ${log.id}
        `,
    );

    await expectReject(
      () =>
        client`
          DELETE FROM audit_logs WHERE id = ${log.id}
        `,
    );

    const still = await client<{ action: string }[]>`
      SELECT action FROM audit_logs WHERE id = ${log.id}
    `;
    assert.equal(still[0].action, 'IMPORT_STARTED');
  });

  it('restricts source_origin to FILE1/FILE2', async () => {
    const [batch] = await db
      .insert(importBatches)
      .values({ fileName: 'origin.xlsx', fileType: 'FILE1', status: 'RUNNING' })
      .returning();

    await expectReject(
      () =>
        client`
          INSERT INTO kootajs (normalized_kootaj, source_origin, created_import_batch_id)
          VALUES (${`bad-origin-${batch.id}`}, 'FILE3', ${batch.id})
        `,
    );
  });
});

describe('users seed shape', () => {
  it('accepts admin role user insert', async () => {
    const username = `admin-test-${Date.now()}`;
    const [u] = await db
      .insert(users)
      .values({
        username,
        passwordHash: 'scrypt$test$test',
        displayName: 'Test Admin',
        role: 'admin',
      })
      .returning();
    assert.equal(u.role, 'admin');
    assert.equal(u.isActive, true);
  });
});
