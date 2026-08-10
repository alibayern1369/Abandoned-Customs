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

export const KOOTAJ_TABS = [
  'all',
  'complete',
  'with_letter',
  'without_letter',
  'exited',
  'not_exited',
  'incomplete',
  'needs_review',
] as const;

export type KootajTab = (typeof KOOTAJ_TABS)[number];

export type KootajListFilters = {
  q?: string;
  tab?: KootajTab;
  origin?: 'FILE1' | 'FILE2';
  page?: number;
  pageSize?: number;
};

/** Key parent fields used for ناقص / تکمیل‌شده classification.
 * Exit date is NOT required for complete — empty exit means خارج‌نشده (valid).
 * File1 (متروکه) owner defaults to سازمان اموال تملیکی when DB column is empty.
 */
const incompleteSql = sql`(
  (
    ${kootajs.sourceOrigin} <> 'FILE1'
    and (${kootajs.ownerName} is null or btrim(${kootajs.ownerName}) = '')
  )
  or ${kootajs.goodsStatusText} is null or btrim(${kootajs.goodsStatusText}) = ''
  or ${letters.id} is null
)`;

const completeSql = sql`(
  (
    ${kootajs.sourceOrigin} = 'FILE1'
    or (${kootajs.ownerName} is not null and btrim(${kootajs.ownerName}) <> '')
  )
  and ${kootajs.goodsStatusText} is not null and btrim(${kootajs.goodsStatusText}) <> ''
  and ${letters.id} is not null
)`;

/** File1 exit column: date/ref → خارج‌شده؛ «خارج نشده است» یا خالی → خارج‌نشده */
const exitedSql = sql`${kootajs.exitText} is not null
  and btrim(${kootajs.exitText}) <> ''
  and ${kootajs.exitText} not ilike '%خارج نشده%'`;
const notExitedSql = sql`${kootajs.exitText} is null
  or btrim(${kootajs.exitText}) = ''
  or ${kootajs.exitText} ilike '%خارج نشده%'`;

function openReviewExists(): SQL {
  return exists(
    getDb()
      .select({ id: reviewItems.id })
      .from(reviewItems)
      .where(and(eq(reviewItems.kootajId, kootajs.id), eq(reviewItems.status, 'OPEN'))),
  );
}

function warehouseReceiptExists(pattern: string): SQL {
  return exists(
    getDb()
      .select({ id: kootajItems.id })
      .from(kootajItems)
      .where(
        and(
          eq(kootajItems.kootajId, kootajs.id),
          or(
            ilike(kootajItems.warehouseReceiptNo, pattern),
            ilike(kootajItems.eWarehouseReceiptNo, pattern),
          ),
        ),
      ),
  );
}

function applyTabFilter(tab: KootajTab | undefined, parts: SQL[]): void {
  switch (tab) {
    case 'with_letter':
      parts.push(isNotNull(letters.id));
      break;
    case 'without_letter':
      parts.push(isNull(letters.id));
      break;
    case 'exited':
      parts.push(exitedSql);
      break;
    case 'not_exited':
      parts.push(notExitedSql);
      break;
    case 'needs_review':
      parts.push(openReviewExists());
      break;
    case 'incomplete':
      parts.push(incompleteSql);
      break;
    case 'complete':
      parts.push(completeSql);
      break;
    case 'all':
    case undefined:
    default:
      break;
  }
}

function buildKootajWhere(filters: KootajListFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.origin) {
    parts.push(eq(kootajs.sourceOrigin, filters.origin));
  }

  applyTabFilter(filters.tab, parts);

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const search = or(
      ilike(kootajs.normalizedKootaj, pattern),
      ilike(kootajs.displayKootaj, pattern),
      ilike(kootajs.ownerName, pattern),
      ilike(kootajs.orderRegistrationNo, pattern),
      ilike(letters.letterNumber, pattern),
      warehouseReceiptExists(pattern),
    );
    if (search) parts.push(search);
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export function parseKootajTab(value: string | undefined): KootajTab {
  if (value && (KOOTAJ_TABS as readonly string[]).includes(value)) {
    return value as KootajTab;
  }
  return 'all';
}

export async function getDashboardStats() {
  const db = getDb();

  const [totals] = await db
    .select({
      totalKootajs: count(kootajs.id),
      withLetter: sql<number>`count(${letters.id})::int`,
      file2: sql<number>`count(*) filter (where ${kootajs.sourceOrigin} = 'FILE2')::int`,
      exited: sql<number>`count(*) filter (where ${kootajs.exitText} is not null and btrim(${kootajs.exitText}) <> '' and ${kootajs.exitText} not ilike '%خارج نشده%')::int`,
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

export type TabCounts = Record<KootajTab, number>;

export async function getTabCounts(q?: string): Promise<TabCounts> {
  const db = getDb();
  const baseFilters: KootajListFilters = { q: q || undefined };

  const counts = {} as TabCounts;
  await Promise.all(
    KOOTAJ_TABS.map(async (tab) => {
      const where = buildKootajWhere({ ...baseFilters, tab });
      const query = db
        .select({ value: count(kootajs.id) })
        .from(kootajs)
        .leftJoin(letters, eq(letters.kootajId, kootajs.id));
      const [row] = where ? await query.where(where) : await query;
      counts[tab] = Number(row?.value ?? 0);
    }),
  );
  return counts;
}

export type KootajListRow = {
  id: string;
  normalizedKootaj: string;
  displayKootaj: string | null;
  sourceOrigin: 'FILE1' | 'FILE2';
  ownerName: string | null;
  orderRegistrationNo: string | null;
  goodsStatusText: string | null;
  exitText: string | null;
  hasParentFieldConflict: boolean;
  createdAt: Date;
  letterNumber: string | null;
  letterDate: string | null;
  warehouseReceipts: string | null;
  openReviewCount: number;
  isIncomplete: boolean;
  isComplete: boolean;
};

export async function listKootajs(filters: KootajListFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 24));
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
      warehouseReceipts: sql<string | null>`(
        select string_agg(distinct receipt, '، ' order by receipt)
        from (
          select nullif(btrim(warehouse_receipt_no), '') as receipt
          from kootaj_items
          where kootaj_id = ${kootajs.id}
          union
          select nullif(btrim(e_warehouse_receipt_no), '') as receipt
          from kootaj_items
          where kootaj_id = ${kootajs.id}
        ) receipts
        where receipt is not null
      )`,
      openReviewCount: sql<number>`(
        select count(*)::int from review_items ri
        where ri.kootaj_id = ${kootajs.id} and ri.status = 'OPEN'
      )`,
      isIncomplete: sql<boolean>`${incompleteSql}`,
      isComplete: sql<boolean>`${completeSql}`,
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
    rows: rows as KootajListRow[],
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
  };
}

/** All matching rows for export (capped). */
export async function listKootajsForExport(filters: KootajListFilters = {}, limit = 5000) {
  const result = await listKootajs({ ...filters, page: 1, pageSize: Math.min(limit, 5000) });
  return result;
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

  const hasOwner =
    Boolean(parent.ownerName?.trim()) || parent.sourceOrigin === 'FILE1';
  const isIncomplete = !hasOwner || !parent.goodsStatusText?.trim() || !letter;
  const isComplete = !isIncomplete;

  return { parent, letter: letter ?? null, items, reviews, isIncomplete, isComplete };
}
