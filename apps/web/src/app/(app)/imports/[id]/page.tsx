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
        <Link href="/imports" className="text-sm text-accent hover:underline">
          ← بازگشت به تاریخچه
        </Link>
      </div>
      <PageHeader title={batch.fileName} description={fileTypeLabel(batch.fileType)} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-line py-2">
          <p className="text-xs text-muted">وضعیت</p>
          <p className="mt-1">
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
        <div className="border-b border-line py-2">
          <p className="text-xs text-muted">زمان ورود</p>
          <p className="mt-1 font-medium">{formatDateTime(batch.importedAt)}</p>
        </div>
        <div className="border-b border-line py-2">
          <p className="text-xs text-muted">اتمام</p>
          <p className="mt-1 font-medium">{formatDateTime(batch.completedAt)}</p>
        </div>
        <div className="border-b border-line py-2">
          <p className="text-xs text-muted">ردیف‌های provenance</p>
          <p className="mt-1 font-medium tabular-nums">{faNumber(importRowCount)}</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['کل ردیف', batch.totalRows],
          ['ایجاد', batch.createdRecords],
          ['رد شده', batch.skippedRecords],
          ['بررسی', batch.reviewRecords],
          ['خطا', batch.errorRecords],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-b border-line py-2">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{faNumber(value as number)}</p>
          </div>
        ))}
      </section>

      {batch.errorMessage ? (
        <p className="mt-4 text-sm text-danger">{batch.errorMessage}</p>
      ) : null}

      <section className="mt-10">
        <h3 className="mb-3 text-lg font-semibold">خلاصه موارد بررسی</h3>
        {reviewCounts.length === 0 ? (
          <EmptyState message="بررسی‌ای برای این batch نیست." />
        ) : (
          <ul className="space-y-2 text-sm">
            {reviewCounts.map((row) => (
              <li key={`${row.status}-${row.type}`} className="flex gap-2">
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

      <section className="mt-10">
        <h3 className="mb-3 text-lg font-semibold">آخرین موارد بررسی</h3>
        {recentReviews.length === 0 ? (
          <EmptyState message="موردی نیست." />
        ) : (
          <ul className="space-y-3">
            {recentReviews.map((row) => (
              <li key={row.id} className="border-b border-line py-2 text-sm">
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
        <Link href="/reviews?status=OPEN" className="mt-3 inline-block text-sm text-accent hover:underline">
          مشاهده صف بررسی
        </Link>
      </section>
    </div>
  );
}
