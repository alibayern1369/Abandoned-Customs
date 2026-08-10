import Link from 'next/link';
import { Badge } from '@/components/ui';
import { exitDisplay, faNumber, isExited, sourceOriginLabel } from '@/lib/labels';
import type { KootajListRow } from '@/lib/queries/kootajs';

const DEFAULT_OWNER = 'سازمان اموال تملیکی';

export function KootajCard({ row }: { row: KootajListRow }) {
  const title = row.displayKootaj || row.normalizedKootaj;
  const hasExit = isExited(row.exitText);
  const openReviews = Number(row.openReviewCount) > 0;
  const owner = row.ownerName?.trim() || DEFAULT_OWNER;
  const receipts = row.warehouseReceipts?.trim() || '—';

  return (
    <Link
      href={`/kootajs/${row.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-elevated p-4 shadow-panel transition hover:-translate-y-0.5 hover:border-accent/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">کوتاژ</p>
          <p className="truncate text-lg font-bold tracking-tight text-ink group-hover:text-accent">
            {title}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-faint">{row.normalizedKootaj}</p>
          <p className="mt-2 text-xs text-muted">قبض انبار</p>
          <p className="mt-0.5 truncate text-sm tabular-nums font-medium text-ink">{receipts}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {hasExit ? <Badge tone="ok">خارج‌شده</Badge> : <Badge tone="warn">خارج‌نشده</Badge>}
          {row.isComplete ? <Badge tone="ok">تکمیل</Badge> : null}
          {row.isIncomplete ? <Badge tone="warn">ناقص</Badge> : null}
          {openReviews ? <Badge tone="danger">بررسی</Badge> : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">مالک</dt>
          <dd className="truncate font-medium">{owner}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">نامه</dt>
          <dd className="font-medium">{row.letterNumber || 'بدون نامه'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">خروج</dt>
          <dd className="truncate font-medium">{exitDisplay(row.exitText)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">وضعیت کالا</dt>
          <dd className="truncate font-medium">{row.goodsStatusText || '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3 text-xs text-muted">
        <span>{sourceOriginLabel(row.sourceOrigin)}</span>
        {openReviews ? (
          <span className="text-warn">{faNumber(row.openReviewCount)} مورد باز</span>
        ) : (
          <span>مشاهده جزئیات</span>
        )}
      </div>
    </Link>
  );
}
