import Link from 'next/link';
import { Badge, EmptyState, PageHeader, Pagination } from '@/components/ui';
import {
  faNumber,
  formatDateTime,
  sourceOriginLabel,
} from '@/lib/labels';
import { listKootajs } from '@/lib/queries/kootajs';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function KootajsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? '';
  const origin = one(sp.origin);
  const letter = one(sp.letter);
  const exit = one(sp.exit);
  const needsReview = one(sp.needsReview) === '1';
  const page = Number(one(sp.page) ?? '1') || 1;

  const result = await listKootajs({
    q: q || undefined,
    origin: origin === 'FILE1' || origin === 'FILE2' ? origin : undefined,
    letter: letter === 'with' || letter === 'without' ? letter : undefined,
    exit: exit === 'exited' || exit === 'not_exited' ? exit : undefined,
    needsReview: needsReview || undefined,
    page,
  });

  const query = {
    q: q || undefined,
    origin,
    letter,
    exit,
    needsReview: needsReview ? '1' : undefined,
  };

  return (
    <div>
      <PageHeader
        title="کوتاژها"
        description="فیلترها مستقل‌اند؛ وضعیت واحد برای کوتاژ تعریف نشده است."
      />

      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs text-muted">جستجو</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="کوتاژ، مالک، ثبت سفارش، نامه…"
            className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">منبع</span>
          <select name="origin" defaultValue={origin ?? ''} className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm">
            <option value="">همه</option>
            <option value="FILE1">فایل ۱</option>
            <option value="FILE2">فایل ۲ (جدید)</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">نامه</span>
          <select name="letter" defaultValue={letter ?? ''} className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm">
            <option value="">همه</option>
            <option value="with">با نامه</option>
            <option value="without">بدون نامه</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">خروج</span>
          <select name="exit" defaultValue={exit ?? ''} className="w-full rounded-md border border-line bg-elevated px-3 py-2 text-sm">
            <option value="">همه</option>
            <option value="exited">دارای متن خروج</option>
            <option value="not_exited">بدون متن خروج</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="needsReview" value="1" defaultChecked={needsReview} />
          <span className="text-sm">نیاز به بررسی</span>
        </label>
        <div className="flex items-end lg:col-span-6">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            اعمال فیلتر
          </button>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState message="کوتاژی با این فیلتر پیدا نشد." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-line text-right text-muted">
                <th className="px-2 py-2 font-medium">کوتاژ</th>
                <th className="px-2 py-2 font-medium">منبع</th>
                <th className="px-2 py-2 font-medium">مالک</th>
                <th className="px-2 py-2 font-medium">نامه</th>
                <th className="px-2 py-2 font-medium">وضعیت کالا</th>
                <th className="px-2 py-2 font-medium">خروج</th>
                <th className="px-2 py-2 font-medium">بررسی باز</th>
                <th className="px-2 py-2 font-medium">ایجاد</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 align-top">
                  <td className="px-2 py-3">
                    <Link href={`/kootajs/${row.id}`} className="font-semibold hover:text-accent">
                      {row.displayKootaj || row.normalizedKootaj}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">{row.normalizedKootaj}</p>
                  </td>
                  <td className="px-2 py-3">{sourceOriginLabel(row.sourceOrigin)}</td>
                  <td className="px-2 py-3">{row.ownerName || '—'}</td>
                  <td className="px-2 py-3">
                    {row.letterNumber ? (
                      <Badge tone="ok">{row.letterNumber}</Badge>
                    ) : (
                      <span className="text-muted">ندارد</span>
                    )}
                  </td>
                  <td className="px-2 py-3 max-w-[10rem] truncate">{row.goodsStatusText || '—'}</td>
                  <td className="px-2 py-3 max-w-[10rem] truncate">{row.exitText || '—'}</td>
                  <td className="px-2 py-3">
                    {Number(row.openReviewCount) > 0 ? (
                      <Badge tone="warn">{faNumber(row.openReviewCount)}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/kootajs"
        query={query}
      />
    </div>
  );
}
