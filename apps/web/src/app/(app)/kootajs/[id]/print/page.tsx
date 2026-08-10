import Link from 'next/link';
import { notFound } from 'next/navigation';
import { faNumber, formatDateTime, formatRial, exitDisplay, sourceOriginLabel } from '@/lib/labels';
import { getKootajDetail } from '@/lib/queries/kootajs';
import { PrintTrigger } from '@/components/PrintTrigger';

const DEFAULT_OWNER = 'سازمان اموال تملیکی';

export default async function KootajPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getKootajDetail(id);
  if (!detail) notFound();
  const { parent, letter, items, isComplete, isIncomplete } = detail;

  const fields: Array<[string, string | null | undefined]> = [
    ['کوتاژ', parent.displayKootaj || parent.normalizedKootaj],
    ['نرمال', parent.normalizedKootaj],
    ['منبع', sourceOriginLabel(parent.sourceOrigin)],
    ['تاریخ کوتاژ', parent.kootajDate],
    ['مالک', parent.ownerName?.trim() || DEFAULT_OWNER],
    ['کد مالک', parent.ownerCode],
    ['حق‌العمل‌کار', parent.brokerName],
    ['اظهارکننده', parent.declarantName],
    ['محل ارزیابی', parent.assessmentLocation],
    ['مرحله اظهار', parent.declarationStage],
    ['ثبت سفارش', parent.orderRegistrationNo],
    ['وضعیت کالا', parent.goodsStatusText],
    ['خروج', exitDisplay(parent.exitText)],
    ['کشور مبدأ', parent.originCountry],
    ['ارزش ریالی (ریال)', formatRial(parent.rialValue)],
    [
      'ارزش ارزی',
      parent.fxValue ? `${formatRial(parent.fxValue)} ${parent.fxCurrency ?? ''}`.trim() : null,
    ],
  ];

  return (
    <div className="print-root mx-auto max-w-4xl bg-white px-6 py-8 text-ink">
      <PrintTrigger />
      <header className="mb-6 border-b border-ink pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">سامانه گمرکی متروکه</p>
            <h1 className="mt-1 text-2xl font-bold">
              {parent.displayKootaj || parent.normalizedKootaj}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isComplete ? 'تکمیل‌شده' : isIncomplete ? 'ناقص' : ''} ·{' '}
              {formatDateTime(new Date())}
            </p>
          </div>
          <Link href={`/kootajs/${id}`} className="text-sm text-accent print:hidden">
            بازگشت
          </Link>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">اطلاعات کوتاژ</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-line py-1.5">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-medium">{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">نامه</h2>
        {!letter ? (
          <p className="text-sm text-muted">بدون نامه</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">شماره</p>
              <p className="font-medium">{letter.letterNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted">تاریخ</p>
              <p className="font-medium">{letter.letterDate || '—'}</p>
            </div>
            <div className="sm:col-span-3">
              <p className="text-xs text-muted">شرح</p>
              <p className="font-medium whitespace-pre-wrap">{letter.description || '—'}</p>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">اقلام ({faNumber(items.length)})</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-right">
              <th className="px-2 py-2">ردیف</th>
              <th className="px-2 py-2">تعرفه</th>
              <th className="px-2 py-2">شرح</th>
              <th className="px-2 py-2">وزن</th>
              <th className="px-2 py-2">قبض انبار</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line">
                <td className="px-2 py-2 tabular-nums">{faNumber(item.lineNo)}</td>
                <td className="px-2 py-2">{item.tariffCode || '—'}</td>
                <td className="px-2 py-2">{item.goodsDescription || '—'}</td>
                <td className="px-2 py-2">{item.netWeight || item.grossWeight || '—'}</td>
                <td className="px-2 py-2">{item.warehouseReceiptNo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
