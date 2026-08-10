import Link from 'next/link';
import { exitDisplay, faNumber, formatDateTime, isExited } from '@/lib/labels';
import {
  listKootajsForExport,
  parseKootajTab,
  type KootajTab,
} from '@/lib/queries/kootajs';
import { PrintTrigger } from '@/components/PrintTrigger';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const TAB_LABELS: Record<KootajTab, string> = {
  all: 'همه',
  complete: 'تکمیل‌شده',
  with_letter: 'با نامه',
  without_letter: 'بدون نامه',
  exited: 'خارج‌شده',
  not_exited: 'خارج‌نشده',
  incomplete: 'ناقص',
  needs_review: 'نیاز به بررسی',
};

export default async function KootajsPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = one(sp.q) ?? '';
  const tab = parseKootajTab(one(sp.tab));
  const { rows, total } = await listKootajsForExport({
    q: q || undefined,
    tab,
  });

  return (
    <div className="print-root mx-auto max-w-5xl bg-white px-6 py-8 text-ink">
      <PrintTrigger />
      <header className="mb-6 border-b border-line pb-4 print:border-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-wide text-muted">سامانه گمرکی متروکه</p>
            <h1 className="mt-1 text-2xl font-bold">گزارش کوتاژهای متروکه</h1>
            <p className="mt-2 text-sm text-muted">
              دسته: {TAB_LABELS[tab]}
              {q ? ` · جستجو: ${q}` : ''} · تعداد: {faNumber(total)}
            </p>
            <p className="mt-1 text-xs text-muted">{formatDateTime(new Date())}</p>
          </div>
          <Link href="/kootajs" className="text-sm text-accent print:hidden">
            بازگشت
          </Link>
        </div>
      </header>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-right">
            <th className="px-2 py-2 font-semibold">کوتاژ</th>
            <th className="px-2 py-2 font-semibold">قبض انبار</th>
            <th className="px-2 py-2 font-semibold">مالک</th>
            <th className="px-2 py-2 font-semibold">نامه</th>
            <th className="px-2 py-2 font-semibold">وضعیت کالا</th>
            <th className="px-2 py-2 font-semibold">خروج</th>
            <th className="px-2 py-2 font-semibold">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-top">
              <td className="px-2 py-2">
                <div className="text-[10px] text-muted">کوتاژ</div>
                <div className="font-medium">{row.displayKootaj || row.normalizedKootaj}</div>
              </td>
              <td className="px-2 py-2">
                <div className="text-[10px] text-muted">قبض انبار</div>
                <div className="tabular-nums">{row.warehouseReceipts || '—'}</div>
              </td>
              <td className="px-2 py-2">{row.ownerName?.trim() || 'سازمان اموال تملیکی'}</td>
              <td className="px-2 py-2">{row.letterNumber || '—'}</td>
              <td className="px-2 py-2">{row.goodsStatusText || '—'}</td>
              <td className="px-2 py-2">{exitDisplay(row.exitText)}</td>
              <td className="px-2 py-2">
                {row.isComplete ? 'تکمیل' : row.isIncomplete ? 'ناقص' : '—'}
                {isExited(row.exitText) ? ' · خارج‌شده' : ' · خارج‌نشده'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">موردی برای چاپ نیست.</p>
      ) : null}
    </div>
  );
}
