import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import {
  batchStatusLabel,
  faNumber,
  fileTypeLabel,
  formatDateTime,
  reviewStatusLabel,
  reviewTypeLabel,
} from '@/lib/labels';
import { getImportBatchDetail } from '@/lib/queries/imports';

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getImportBatchDetail(id);
  if (!detail) notFound();

  const { batch, importRowCount, reviewCounts, recentReviews } = detail;

  return (
    <div>
      <div className="mb-4">
        <Link href="/imports" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          ← بازگشت به تاریخچه
        </Link>
      </div>
      <PageHeader title={batch.fileName} description={fileTypeLabel(batch.fileType)} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-[1.1rem] px-4 py-3.5">
          <p className="text-xs text-muted">وضعیت</p>
          <p className="mt-1.5">
            <Badge
              tone={
                batch.status === 'FAILED'
                  ? 'danger'
                  : batch.status === 'COMPLETED_WITH_REVIEW'
                    ? 'warn'
                    : 'ok'
              }
            >
              {batchStatusLabel(batch.status)}
            </Badge>
          </p>
        </div>
        <div className="glass rounded-[1.1rem] px-4 py-3.5">
          <p className="text-xs text-muted">زمان ورود</p>
          <p className="mt-1.5 font-medium">{formatDateTime(batch.importedAt)}</p>
        </div>
        <div className="glass rounded-[1.1rem] px-4 py-3.5">
          <p className="text-xs text-muted">اتمام</p>
          <p className="mt-1.5 font-medium">{formatDateTime(batch.completedAt)}</p>
        </div>
        <div className="glass rounded-[1.1rem] px-4 py-3.5">
          <p className="text-xs text-muted">ردیف‌های provenance</p>
          <p className="mt-1.5 font-medium tabular-nums">{faNumber(importRowCount)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['کل ردیف', batch.totalRows],
          ['ایجاد', batch.createdRecords],
          ['رد شده', batch.skippedRecords],
          ['بررسی', batch.reviewRecords],
          ['خطا', batch.errorRecords],
        ].map(([label, value]) => (
          <div key={String(label)} className="glass rounded-[1.1rem] px-4 py-3.5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
              {faNumber(value as number)}
            </p>
          </div>
        ))}
      </section>

      {batch.errorMessage ? (
        <p className="mt-4 rounded-[0.9rem] bg-rose-50/80 px-3.5 py-2.5 text-sm text-danger ring-1 ring-rose-200/50">
          {batch.errorMessage}
        </p>
      ) : null}

      <section className="glass mt-10 rounded-[1.25rem] p-5">
        <h3 className="mb-3 text-lg font-semibold tracking-tight">خلاصه موارد بررسی</h3>
        {reviewCounts.length === 0 ? (
          <EmptyState message="بررسی‌ای برای این batch نیست." />
        ) : (
          <ul className="space-y-2 text-sm">
            {reviewCounts.map((row) => (
              <li key={`${row.status}-${row.type}`} className="glass-inset flex gap-2 rounded-[0.85rem] px-3 py-2">
                <Badge tone={row.status === 'OPEN' ? 'warn' : 'neutral'}>
                  {reviewStatusLabel(row.status)}
                </Badge>
                <span>{reviewTypeLabel(row.type)}</span>
                <span className="tabular-nums text-muted">{faNumber(row.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass mt-6 rounded-[1.25rem] p-5">
        <h3 className="mb-3 text-lg font-semibold tracking-tight">آخرین موارد بررسی</h3>
        {recentReviews.length === 0 ? (
          <EmptyState message="موردی نیست." />
        ) : (
          <ul className="space-y-3">
            {recentReviews.map((row) => (
              <li key={row.id} className="glass-inset rounded-[0.9rem] px-3.5 py-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={row.status === 'OPEN' ? 'warn' : 'neutral'}>
                    {reviewStatusLabel(row.status)}
                  </Badge>
                  <span>{reviewTypeLabel(row.type)}</span>
                  <span className="text-muted">{row.normalizedKootaj || '—'}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/reviews?status=OPEN"
          className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          مشاهده صف بررسی
        </Link>
      </section>
    </div>
  );
}
