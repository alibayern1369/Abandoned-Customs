import Link from 'next/link';
import { ignoreReviewAction, resolveReviewAction } from '@/app/actions';
import { Badge, EmptyState, PageHeader, Pagination } from '@/components/ui';
import {
  faNumber,
  formatDateTime,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/lib/labels';
import { listReviews } from '@/lib/queries/reviews';
import type { ReviewItemStatus, ReviewItemType } from '@metrookeh/domain';
import { REVIEW_ITEM_STATUSES, REVIEW_ITEM_TYPES } from '@metrookeh/domain';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusRaw = one(sp.status) ?? 'OPEN';
  const typeRaw = one(sp.type);
  const page = Number(one(sp.page) ?? '1') || 1;

  const status = REVIEW_ITEM_STATUSES.includes(statusRaw as ReviewItemStatus)
    ? (statusRaw as ReviewItemStatus)
    : undefined;
  const type = REVIEW_ITEM_TYPES.includes(typeRaw as ReviewItemType)
    ? (typeRaw as ReviewItemType)
    : undefined;

  const result = await listReviews({ status, type, page });

  return (
    <div>
      <PageHeader
        title="صف بررسی"
        description="resolve فقط وضعیت صف را می‌بندد و نامه/کوتاژ را خودکار تغییر نمی‌دهد."
      />

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <label>
          <span className="mb-1 block text-xs text-muted">وضعیت</span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded-md border border-line bg-elevated px-3 py-2 text-sm"
          >
            <option value="">همه</option>
            {REVIEW_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {reviewStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">نوع</span>
          <select
            name="type"
            defaultValue={type ?? ''}
            className="rounded-md border border-line bg-elevated px-3 py-2 text-sm"
          >
            <option value="">همه</option>
            {REVIEW_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {reviewTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            فیلتر
          </button>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState message="موردی در صف بررسی نیست." />
      ) : (
        <ul className="space-y-5">
          {result.rows.map((row) => (
            <li key={row.id} className="border-b border-line pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    row.status === 'OPEN' ? 'warn' : row.status === 'RESOLVED' ? 'ok' : 'neutral'
                  }
                >
                  {reviewStatusLabel(row.status)}
                </Badge>
                <span className="font-medium">{reviewTypeLabel(row.type)}</span>
                <span className="text-xs text-muted">{formatDateTime(row.createdAt)}</span>
              </div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">کوتاژ نرمال: </span>
                  {row.normalizedKootaj || '—'}
                </p>
                <p>
                  <span className="text-muted">شناسه کوتاژ: </span>
                  {row.kootajId ? (
                    <Link href={`/kootajs/${row.kootajId}`} className="text-accent hover:underline">
                      مشاهده
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
                <p>
                  <span className="text-muted">batch: </span>
                  <Link href={`/imports/${row.importBatchId}`} className="text-accent hover:underline">
                    {row.importBatchId.slice(0, 8)}…
                  </Link>
                </p>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto rounded bg-elevated p-3 text-xs text-muted">
                {JSON.stringify(row.payload ?? {}, null, 2)}
              </pre>
              {row.status === 'OPEN' ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <form action={resolveReviewAction} className="space-y-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="note"
                      placeholder="یادداشت حل (اختیاری)"
                      className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-ok px-3 py-1.5 text-sm font-medium text-white"
                    >
                      حل‌شده
                    </button>
                  </form>
                  <form action={ignoreReviewAction} className="space-y-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="note"
                      placeholder="یادداشت نادیده (اختیاری)"
                      className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-3 py-1.5 text-sm font-medium"
                    >
                      نادیده گرفتن
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {row.resolutionNote || 'بدون یادداشت'} · {formatDateTime(row.resolvedAt)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/reviews"
        query={{
          status: status ?? undefined,
          type: type ?? undefined,
        }}
      />
      <p className="mt-2 text-xs text-muted">{faNumber(result.total)} مورد</p>
    </div>
  );
}
