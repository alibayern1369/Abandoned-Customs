import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { reviewItems } from '@metrookeh/db';
import type { ReviewItemStatus, ReviewItemType } from '@metrookeh/domain';
import { getDb } from '../db';

export type ReviewListFilters = {
  status?: ReviewItemStatus;
  type?: ReviewItemType;
  page?: number;
  pageSize?: number;
};

export async function listReviews(filters: ReviewListFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const parts: SQL[] = [];
  if (filters.status) parts.push(eq(reviewItems.status, filters.status));
  if (filters.type) parts.push(eq(reviewItems.type, filters.type));
  const where = parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : and(...parts);

  const base = db.select().from(reviewItems);
  const rows = where
    ? await base.where(where).orderBy(desc(reviewItems.createdAt)).limit(pageSize).offset(offset)
    : await base.orderBy(desc(reviewItems.createdAt)).limit(pageSize).offset(offset);

  const countBase = db.select({ value: count() }).from(reviewItems);
  const [totalRow] = where ? await countBase.where(where) : await countBase;

  return {
    rows,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
  };
}

export async function resolveReviewItem(input: {
  id: string;
  userId: string;
  note?: string;
  status: 'RESOLVED' | 'IGNORED';
}) {
  const db = getDb();
  const [updated] = await db
    .update(reviewItems)
    .set({
      status: input.status,
      resolutionNote: input.note?.trim() || null,
      resolvedBy: input.userId,
      resolvedAt: new Date(),
    })
    .where(and(eq(reviewItems.id, input.id), eq(reviewItems.status, 'OPEN')))
    .returning({ id: reviewItems.id });

  return Boolean(updated);
}
