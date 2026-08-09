import Link from 'next/link';
import { PageHeader, StatLink, EmptyState, Badge } from '@/components/ui';
import {
  batchStatusLabel,
  faNumber,
  fileTypeLabel,
  formatDateTime,
} from '@/lib/labels';
import { getDashboardStats } from '@/lib/queries/kootajs';

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <PageHeader
        title="خلاصه وضعیت"
        description="نمای کلی محورهای مستقل کوتاژ، نامه، خروج و صف بررسی"
      />

      <section className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
        <StatLink href="/kootajs" label="همه کوتاژها" value={stats.totalKootajs} />
        <StatLink href="/kootajs?tab=with_letter" label="با نامه" value={stats.withLetter} />
        <StatLink href="/kootajs?tab=without_letter" label="بدون نامه" value={stats.withoutLetter} />
        <StatLink href="/kootajs?tab=exited" label="خارج‌شده" value={stats.exited} />
        <StatLink href="/kootajs?tab=needs_review" label="نیاز به بررسی" value={stats.openReviews} />
        <StatLink href="/imports/upload" label="آپلود اکسل" value={stats.recentBatches.length} />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="text-lg font-semibold">آخرین ورودها</h3>
          <Link href="/imports" className="text-sm text-accent hover:underline">
            همه تاریخچه
          </Link>
        </div>
        {stats.recentBatches.length === 0 ? (
          <EmptyState message="هنوز هیچ batch ورودی ثبت نشده است." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-right text-muted">
                  <th className="px-2 py-2 font-medium">فایل</th>
                  <th className="px-2 py-2 font-medium">نوع</th>
                  <th className="px-2 py-2 font-medium">وضعیت</th>
                  <th className="px-2 py-2 font-medium">ردیف‌ها</th>
                  <th className="px-2 py-2 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-b border-line/70">
                    <td className="px-2 py-3">
                      <Link href={`/imports/${batch.id}`} className="font-medium hover:text-accent">
                        {batch.fileName}
                      </Link>
                    </td>
                    <td className="px-2 py-3">{fileTypeLabel(batch.fileType)}</td>
                    <td className="px-2 py-3">
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
                    </td>
                    <td className="px-2 py-3 tabular-nums">{faNumber(batch.totalRows)}</td>
                    <td className="px-2 py-3 text-muted">{formatDateTime(batch.importedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
