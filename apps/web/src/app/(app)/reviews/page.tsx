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

      <form method="get" className="glass mb-6 flex flex-wrap gap-3 rounded-[1.2rem] p-4 sm:p-5">
        <label>
          <span className="mb-1.5 block text-xs text-muted">وضعیت</span>
          <select name="status" defaultValue={status ?? ''} className="ui-select">
            <option value="">همه</option>
            {REVIEW_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {reviewStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs text-muted">نوع</span>
          <select name="type" defaultValue={type ?? ''} className="ui-select">
            <option value="">همه</option>
            {REVIEW_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {reviewTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="ui-btn ui-btn-primary">
            فیلتر
          </button>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState message="موردی در صف بررسی نیست." />
      ) : (
        <ul className="space-y-4">
          {result.rows.map((row) => (
            <li key={row.id} className="glass rounded-[1.2rem] p-5">
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
              <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">کوتاژ نرمال: </span>
                  {row.normalizedKootaj || '—'}
                </p>
                <p>
                  <span className="text-muted">شناسه کوتاژ: </span>
                  {row.kootajId ? (
                    <Link
                      href={`/kootajs/${row.kootajId}`}
                      className="font-medium text-accent underline-offset-4 hover:underline"
                    >
                      مشاهده
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
                <p>
                  <span className="text-muted">batch: </span>
                  <Link
                    href={`/imports/${row.importBatchId}`}
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {row.importBatchId.slice(0, 8)}…
                  </Link>
                </p>
              </div>
              <pre className="mt-3 max-h-40 overflow-auto rounded-[0.9rem] bg-white/50 p-3.5 text-xs text-muted ring-1 ring-line/50">
                {JSON.stringify(row.payload ?? {}, null, 2)}
              </pre>
              {row.status === 'OPEN' ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <form action={resolveReviewAction} className="space-y-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="note"
                      placeholder="یادداشت حل (اختیاری)"
                      className="ui-input"
                    />
                    <button type="submit" className="ui-btn ui-btn-primary">
                      حل‌شده
                    </button>
                  </form>
                  <form action={ignoreReviewAction} className="space-y-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="note"
                      placeholder="یادداشت نادیده (اختیاری)"
                      className="ui-input"
                    />
                    <button type="submit" className="ui-btn ui-btn-secondary">
                      نادیده گرفتن
                    </button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
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
