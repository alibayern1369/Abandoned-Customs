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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatLink href="/kootajs" label="همه کوتاژها" value={stats.totalKootajs} />
        <StatLink href="/kootajs?tab=with_letter" label="با نامه" value={stats.withLetter} />
        <StatLink href="/kootajs?tab=without_letter" label="بدون نامه" value={stats.withoutLetter} />
        <StatLink href="/kootajs?tab=exited" label="خارج‌شده" value={stats.exited} />
        <StatLink href="/kootajs?tab=needs_review" label="نیاز به بررسی" value={stats.openReviews} />
        <StatLink href="/imports/upload" label="آپلود اکسل" value={stats.recentBatches.length} />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">آخرین ورودها</h3>
          <Link href="/imports" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            همه تاریخچه
          </Link>
        </div>
        {stats.recentBatches.length === 0 ? (
          <EmptyState message="هنوز هیچ batch ورودی ثبت نشده است." />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table min-w-[40rem]">
              <thead>
                <tr>
                  <th>فایل</th>
                  <th>نوع</th>
                  <th>وضعیت</th>
                  <th>ردیف‌ها</th>
                  <th>زمان</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <Link href={`/imports/${batch.id}`} className="font-medium hover:text-accent">
                        {batch.fileName}
                      </Link>
                    </td>
                    <td>{fileTypeLabel(batch.fileType)}</td>
                    <td>
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
                    <td className="tabular-nums">{faNumber(batch.totalRows)}</td>
                    <td className="text-muted">{formatDateTime(batch.importedAt)}</td>
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
