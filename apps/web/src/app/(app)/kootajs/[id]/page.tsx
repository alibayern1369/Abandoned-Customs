import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import {
  faNumber,
  formatDateTime,
  formatRial,
  exitDisplay,
  isExited,
  reviewStatusLabel,
  reviewTypeLabel,
  sourceOriginLabel,
} from '@/lib/labels';
import { getKootajDetail } from '@/lib/queries/kootajs';

const DEFAULT_OWNER = 'سازمان اموال تملیکی';

export default async function KootajDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getKootajDetail(id);
  if (!detail) notFound();

  const { parent, letter, items, reviews, isIncomplete, isComplete } = detail;
  const hasExit = isExited(parent.exitText);
  const owner = parent.ownerName?.trim() || DEFAULT_OWNER;

  const fields: Array<[string, string | null | undefined]> = [
    ['کوتاژ نرمال', parent.normalizedKootaj],
    ['نمایش', parent.displayKootaj],
    ['منبع', sourceOriginLabel(parent.sourceOrigin)],
    ['تاریخ کوتاژ', parent.kootajDate],
    ['مالک', owner],
    ['کد مالک', parent.ownerCode],
    ['حق‌العمل‌کار', parent.brokerName],
    ['کد حق‌العمل‌کار', parent.brokerCode],
    ['اظهارکننده', parent.declarantName],
    ['کد اظهارکننده', parent.declarantCode],
    ['محل ارزیابی', parent.assessmentLocation],
    ['مرحله اظهار', parent.declarationStage],
    ['ثبت سفارش', parent.orderRegistrationNo],
    ['وضعیت کالا', parent.goodsStatusText],
    ['اعلام به تملیکی', parent.announcedToTamlikText],
    ['خروج', exitDisplay(parent.exitText)],
    ['کشور مبدأ', parent.originCountry],
    ['کشور صادرکننده', parent.exportCountry],
    ['کشور طرف معامله', parent.tradeCountry],
    ['ارزش ریالی (ریال)', formatRial(parent.rialValue)],
    [
      'ارزش ارزی',
      parent.fxValue ? `${formatRial(parent.fxValue)} ${parent.fxCurrency ?? ''}`.trim() : null,
    ],
    ['نرخ ارز', parent.fxRate ? formatRial(parent.fxRate) : null],
    ['حقوق استنباطی (ریال)', formatRial(parent.customsInferredDuty)],
    ['واریزی تملیکی (ریال)', formatRial(parent.tamlikDeposit)],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/kootajs" className="text-sm text-accent hover:underline">
          ← بازگشت به فهرست
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/kootajs/${id}/print`}
            target="_blank"
            className="rounded-full border border-line bg-elevated px-3.5 py-2 text-sm font-medium transition hover:bg-accent-soft"
          >
            پرینت / PDF
          </Link>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {isComplete ? <Badge tone="ok">تکمیل‌شده</Badge> : null}
        {isIncomplete ? <Badge tone="warn">ناقص</Badge> : null}
        {letter ? <Badge tone="ok">با نامه</Badge> : <Badge>بدون نامه</Badge>}
        {hasExit ? <Badge tone="ok">خارج‌شده</Badge> : <Badge tone="warn">خارج‌نشده</Badge>}
      </div>

      <PageHeader
        title={parent.displayKootaj || parent.normalizedKootaj}
        description={`شناسه نرمال: ${parent.normalizedKootaj}`}
      />

      {parent.hasParentFieldConflict ? (
        <p className="mb-4 text-sm text-warn">این کوتاژ تعارض فیلد والد دارد.</p>
      ) : null}

      <section className="rounded-2xl border border-line bg-elevated p-4 shadow-panel sm:p-5">
        <h3 className="mb-4 text-base font-semibold">اطلاعات کوتاژ</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface px-3 py-2.5">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums">{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-elevated p-4 shadow-panel sm:p-5">
        <h3 className="mb-3 text-base font-semibold">نامه</h3>
        {!letter ? (
          <EmptyState message="نامه‌ای به این کوتاژ الصاق نشده است." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-surface px-3 py-2.5">
              <p className="text-xs text-muted">شماره نامه</p>
              <p className="font-medium">{letter.letterNumber}</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-2.5">
              <p className="text-xs text-muted">تاریخ</p>
              <p className="font-medium">{letter.letterDate || '—'}</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-2.5">
              <p className="text-xs text-muted">ثبت‌کننده</p>
              <p className="font-medium">{letter.registrar || '—'}</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-2.5 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted">شرح</p>
              <p className="font-medium whitespace-pre-wrap">{letter.description || '—'}</p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-elevated p-4 shadow-panel sm:p-5">
        <h3 className="mb-3 text-base font-semibold">اقلام ({faNumber(items.length)})</h3>
        {items.length === 0 ? (
          <EmptyState message="قلم کالایی ثبت نشده است." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-line text-right text-muted">
                  <th className="px-2 py-2 font-medium">ردیف</th>
                  <th className="px-2 py-2 font-medium">تعرفه</th>
                  <th className="px-2 py-2 font-medium">شرح کالا</th>
                  <th className="px-2 py-2 font-medium">وزن خالص</th>
                  <th className="px-2 py-2 font-medium">بسته</th>
                  <th className="px-2 py-2 font-medium">قبض انبار</th>
                  <th className="px-2 py-2 font-medium">قبض الکترونیک</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line/70 align-top">
                    <td className="px-2 py-3 tabular-nums">{faNumber(item.lineNo)}</td>
                    <td className="px-2 py-3">{item.tariffCode || '—'}</td>
                    <td className="px-2 py-3 max-w-[18rem]">{item.goodsDescription || '—'}</td>
                    <td className="px-2 py-3 tabular-nums">{item.netWeight || '—'}</td>
                    <td className="px-2 py-3 tabular-nums">
                      {item.packageCount || '—'}
                      {item.packageType ? ` ${item.packageType}` : ''}
                    </td>
                    <td className="px-2 py-3">{item.warehouseReceiptNo || '—'}</td>
                    <td className="px-2 py-3">{item.eWarehouseReceiptNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-elevated p-4 shadow-panel sm:p-5">
        <h3 className="mb-3 text-base font-semibold">موارد بررسی مرتبط</h3>
        {reviews.length === 0 ? (
          <EmptyState message="مورد بررسی‌ای برای این کوتاژ نیست." />
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl bg-surface px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={review.status === 'OPEN' ? 'warn' : 'neutral'}>
                    {reviewStatusLabel(review.status)}
                  </Badge>
                  <span className="text-sm font-medium">{reviewTypeLabel(review.type)}</span>
                  <span className="text-xs text-muted">{formatDateTime(review.createdAt)}</span>
                </div>
                {review.resolutionNote ? (
                  <p className="mt-1 text-sm text-muted">{review.resolutionNote}</p>
                ) : null}
                <Link href="/reviews?status=OPEN" className="mt-1 inline-block text-xs text-accent hover:underline">
                  رفتن به صف بررسی
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
