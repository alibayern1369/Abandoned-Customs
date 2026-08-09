import { count, desc, eq } from 'drizzle-orm';
import { importBatches, importRows, reviewItems } from '@metrookeh/db';
import { getDb } from '../db';

export async function listImportBatches(page = 1, pageSize = 25) {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(10, pageSize));
  const offset = (safePage - 1) * safeSize;

  const rows = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.importedAt))
    .limit(safeSize)
    .offset(offset);

  const [totalRow] = await db.select({ value: count() }).from(importBatches);

  return {
    rows,
    total: Number(totalRow?.value ?? 0),
    page: safePage,
    pageSize: safeSize,
  };
}

export async function getImportBatchDetail(id: string) {
  const db = getDb();
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id)).limit(1);
  if (!batch) return null;

  const [rowCount] = await db
    .select({ value: count() })
    .from(importRows)
    .where(eq(importRows.importBatchId, id));

  const reviewCounts = await db
    .select({
      status: reviewItems.status,
      type: reviewItems.type,
      value: count(),
    })
    .from(reviewItems)
    .where(eq(reviewItems.importBatchId, id))
    .groupBy(reviewItems.status, reviewItems.type);

  const recentReviews = await db
    .select()
    .from(reviewItems)
    .where(eq(reviewItems.importBatchId, id))
    .orderBy(desc(reviewItems.createdAt))
    .limit(20);

  return {
    batch,
    importRowCount: Number(rowCount?.value ?? 0),
    reviewCounts,
    recentReviews,
  };
}
