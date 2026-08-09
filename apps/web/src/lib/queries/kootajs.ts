import {
  and,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  importBatches,
  kootajItems,
  kootajs,
  letters,
  reviewItems,
} from '@metrookeh/db';
import { getDb } from '../db';

export type KootajListFilters = {
  q?: string;
  origin?: 'FILE1' | 'FILE2';
  letter?: 'with' | 'without';
  exit?: 'exited' | 'not_exited';
  needsReview?: boolean;
  page?: number;
  pageSize?: number;
};

function buildKootajWhere(filters: KootajListFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.origin) {
    parts.push(eq(kootajs.sourceOrigin, filters.origin));
  }

  if (filters.letter === 'with') {
    parts.push(isNotNull(letters.id));
  } else if (filters.letter === 'without') {
    parts.push(isNull(letters.id));
  }

  if (filters.exit === 'exited') {
    parts.push(sql`${kootajs.exitText} is not null and btrim(${kootajs.exitText}) <> ''`);
  } else if (filters.exit === 'not_exited') {
    parts.push(sql`${kootajs.exitText} is null or btrim(${kootajs.exitText}) = ''`);
  }

  if (filters.needsReview) {
    parts.push(
      exists(
        getDb()
          .select({ id: reviewItems.id })
          .from(reviewItems)
          .where(and(eq(reviewItems.kootajId, kootajs.id), eq(reviewItems.status, 'OPEN'))),
      ),
    );
  }

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const search = or(
      ilike(kootajs.normalizedKootaj, pattern),
      ilike(kootajs.displayKootaj, pattern),
      ilike(kootajs.ownerName, pattern),
      ilike(kootajs.orderRegistrationNo, pattern),
      ilike(letters.letterNumber, pattern),
    );
    if (search) parts.push(search);
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function getDashboardStats() {
  const db = getDb();

  const [totals] = await db
    .select({
      totalKootajs: count(kootajs.id),
      withLetter: sql<number>`count(${letters.id})::int`,
      file2: sql<number>`count(*) filter (where ${kootajs.sourceOrigin} = 'FILE2')::int`,
      exited: sql<number>`count(*) filter (where ${kootajs.exitText} is not null and btrim(${kootajs.exitText}) <> '')::int`,
    })
    .from(kootajs)
    .leftJoin(letters, eq(letters.kootajId, kootajs.id));

  const [openReviews] = await db
    .select({ value: count() })
    .from(reviewItems)
    .where(eq(reviewItems.status, 'OPEN'));

  const recentBatches = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.importedAt))
    .limit(5);

  return {
    totalKootajs: Number(totals?.totalKootajs ?? 0),
    withLetter: Number(totals?.withLetter ?? 0),
    withoutLetter: Number(totals?.totalKootajs ?? 0) - Number(totals?.withLetter ?? 0),
    file2: Number(totals?.file2 ?? 0),
    exited: Number(totals?.exited ?? 0),
    openReviews: Number(openReviews?.value ?? 0),
    recentBatches,
  };
}

export async function listKootajs(filters: KootajListFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const where = buildKootajWhere(filters);

  const base = db
    .select({
      id: kootajs.id,
      normalizedKootaj: kootajs.normalizedKootaj,
      displayKootaj: kootajs.displayKootaj,
      sourceOrigin: kootajs.sourceOrigin,
      ownerName: kootajs.ownerName,
      orderRegistrationNo: kootajs.orderRegistrationNo,
      goodsStatusText: kootajs.goodsStatusText,
      exitText: kootajs.exitText,
      hasParentFieldConflict: kootajs.hasParentFieldConflict,
      createdAt: kootajs.createdAt,
      letterNumber: letters.letterNumber,
      letterDate: letters.letterDate,
      openReviewCount: sql<number>`(
        select count(*)::int from review_items ri
        where ri.kootaj_id = ${kootajs.id} and ri.status = 'OPEN'
      )`,
    })
    .from(kootajs)
    .leftJoin(letters, eq(letters.kootajId, kootajs.id));

  const rows = where
    ? await base.where(where).orderBy(desc(kootajs.createdAt)).limit(pageSize).offset(offset)
    : await base.orderBy(desc(kootajs.createdAt)).limit(pageSize).offset(offset);

  const countQuery = db
    .select({ value: count(kootajs.id) })
    .from(kootajs)
    .leftJoin(letters, eq(letters.kootajId, kootajs.id));

  const [totalRow] = where ? await countQuery.where(where) : await countQuery;

  return {
    rows,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
  };
}

export async function getKootajDetail(id: string) {
  const db = getDb();

  const [parent] = await db.select().from(kootajs).where(eq(kootajs.id, id)).limit(1);
  if (!parent) return null;

  const [letter] = await db.select().from(letters).where(eq(letters.kootajId, id)).limit(1);
  const items = await db
    .select()
    .from(kootajItems)
    .where(eq(kootajItems.kootajId, id))
    .orderBy(kootajItems.lineNo, kootajItems.createdAt);
  const reviews = await db
    .select()
    .from(reviewItems)
    .where(eq(reviewItems.kootajId, id))
    .orderBy(desc(reviewItems.createdAt));

  return { parent, letter: letter ?? null, items, reviews };
}
