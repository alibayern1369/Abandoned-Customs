import Link from 'next/link';
import { Badge } from '@/components/ui';
import { faNumber, sourceOriginLabel } from '@/lib/labels';
import type { KootajListRow } from '@/lib/queries/kootajs';

export function KootajCard({ row }: { row: KootajListRow }) {
  const title = row.displayKootaj || row.normalizedKootaj;
  const hasExit = Boolean(row.exitText?.trim());
  const openReviews = Number(row.openReviewCount) > 0;

  return (
    <Link
      href={`/kootajs/${row.id}`}
      className="glass group flex flex-col rounded-[1.4rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(35,55,70,0.14)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-ink transition group-hover:text-accent">
            {title}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-muted">{row.normalizedKootaj}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {row.isComplete ? <Badge tone="ok">تکمیل</Badge> : null}
          {row.isIncomplete ? <Badge tone="warn">ناقص</Badge> : null}
          {openReviews ? <Badge tone="danger">بررسی</Badge> : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">مالک</dt>
          <dd className="truncate font-medium">{row.ownerName || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">نامه</dt>
          <dd className="font-medium">{row.letterNumber || 'بدون نامه'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">خروج</dt>
          <dd className="truncate font-medium">{hasExit ? row.exitText : 'خارج نشده'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">وضعیت کالا</dt>
          <dd className="truncate font-medium">{row.goodsStatusText || '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3.5 text-xs text-muted">
        <span>{sourceOriginLabel(row.sourceOrigin)}</span>
        {openReviews ? (
          <span className="font-medium text-warn">{faNumber(row.openReviewCount)} مورد باز</span>
        ) : (
          <span className="font-medium text-accent/80">مشاهده جزئیات</span>
        )}
      </div>
    </Link>
  );
}
