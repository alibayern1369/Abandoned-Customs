import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import {
  faNumber,
  formatDateTime,
  reviewStatusLabel,
  reviewTypeLabel,
  sourceOriginLabel,
} from '@/lib/labels';
import { getKootajDetail } from '@/lib/queries/kootajs';

export default async function KootajDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getKootajDetail(id);
  if (!detail) notFound();

  const { parent, letter, items, reviews, isIncomplete, isComplete } = detail;

  const fields: Array<[string, string | null | undefined]> = [
    ['کوتاژ نرمال', parent.normalizedKootaj],
    ['نمایش', parent.displayKootaj],
    ['منبع', sourceOriginLabel(parent.sourceOrigin)],
    ['تاریخ کوتاژ', parent.kootajDate],
    ['مالک', parent.ownerName],
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
    ['خروج', parent.exitText],
    ['کشور مبدأ', parent.originCountry],
    ['کشور صادرکننده', parent.exportCountry],
    ['کشور طرف معامله', parent.tradeCountry],
    ['ارزش ریالی', parent.rialValue],
    ['ارزش ارزی', parent.fxValue ? `${parent.fxValue} ${parent.fxCurrency ?? ''}`.trim() : null],
    ['نرخ ارز', parent.fxRate],
    ['حقوق استنباطی', parent.customsInferredDuty],
    ['واریزی تملیکی', parent.tamlikDeposit],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/kootajs" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          ← بازگشت به فهرست
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/kootajs/${id}/print`} target="_blank" className="ui-btn ui-btn-secondary">
            پرینت / PDF
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {isComplete ? <Badge tone="ok">تکمیل‌شده</Badge> : null}
        {isIncomplete ? <Badge tone="warn">ناقص</Badge> : null}
        {letter ? <Badge tone="ok">با نامه</Badge> : <Badge>بدون نامه</Badge>}
        {parent.exitText?.trim() ? <Badge tone="ok">خارج‌شده</Badge> : <Badge tone="warn">خارج‌نشده</Badge>}
      </div>

      <PageHeader
        title={parent.displayKootaj || parent.normalizedKootaj}
        description={`شناسه نرمال: ${parent.normalizedKootaj}`}
      />

      {parent.hasParentFieldConflict ? (
        <p className="mb-4 rounded-[0.9rem] bg-amber-50/80 px-3.5 py-2.5 text-sm text-warn ring-1 ring-amber-200/50">
          این کوتاژ تعارض فیلد والد دارد.
        </p>
      ) : null}

      <section className="glass rounded-[1.25rem] p-5 sm:p-6">
        <h3 className="mb-4 text-base font-semibold tracking-tight">اطلاعات کوتاژ</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="glass-inset rounded-[0.95rem] px-3.5 py-3">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-0.5 text-sm font-medium">{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass mt-6 rounded-[1.25rem] p-5 sm:p-6">
        <h3 className="mb-3 text-base font-semibold tracking-tight">نامه</h3>
        {!letter ? (
          <EmptyState message="نامه‌ای به این کوتاژ الصاق نشده است." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass-inset rounded-[0.95rem] px-3.5 py-3">
              <p className="text-xs text-muted">شماره نامه</p>
              <p className="font-medium">{letter.letterNumber}</p>
            </div>
            <div className="glass-inset rounded-[0.95rem] px-3.5 py-3">
              <p className="text-xs text-muted">تاریخ</p>
              <p className="font-medium">{letter.letterDate || '—'}</p>
            </div>
            <div className="glass-inset rounded-[0.95rem] px-3.5 py-3">
              <p className="text-xs text-muted">ثبت‌کننده</p>
              <p className="font-medium">{letter.registrar || '—'}</p>
            </div>
            <div className="glass-inset rounded-[0.95rem] px-3.5 py-3 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted">شرح</p>
              <p className="whitespace-pre-wrap font-medium">{letter.description || '—'}</p>
            </div>
          </div>
        )}
      </section>

      <section className="glass mt-6 rounded-[1.25rem] p-5 sm:p-6">
        <h3 className="mb-3 text-base font-semibold tracking-tight">اقلام ({faNumber(items.length)})</h3>
        {items.length === 0 ? (
          <EmptyState message="قلم کالایی ثبت نشده است." />
        ) : (
          <div className="overflow-x-auto rounded-[1rem] ring-1 ring-line/60">
            <table className="ui-table min-w-[48rem]">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>تعرفه</th>
                  <th>شرح کالا</th>
                  <th>وزن خالص</th>
                  <th>بسته</th>
                  <th>قبض انبار</th>
                  <th>قبض الکترونیک</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="tabular-nums">{faNumber(item.lineNo)}</td>
                    <td>{item.tariffCode || '—'}</td>
                    <td className="max-w-[18rem]">{item.goodsDescription || '—'}</td>
                    <td className="tabular-nums">{item.netWeight || '—'}</td>
                    <td className="tabular-nums">
                      {item.packageCount || '—'}
                      {item.packageType ? ` ${item.packageType}` : ''}
                    </td>
                    <td>{item.warehouseReceiptNo || '—'}</td>
                    <td>{item.eWarehouseReceiptNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass mt-6 rounded-[1.25rem] p-5 sm:p-6">
        <h3 className="mb-3 text-base font-semibold tracking-tight">موارد بررسی مرتبط</h3>
        {reviews.length === 0 ? (
          <EmptyState message="مورد بررسی‌ای برای این کوتاژ نیست." />
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="glass-inset rounded-[0.95rem] px-3.5 py-3">
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
                <Link
                  href="/reviews?status=OPEN"
                  className="mt-1.5 inline-block text-xs font-medium text-accent underline-offset-4 hover:underline"
                >
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
