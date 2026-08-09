import Link from 'next/link';
import { Badge, EmptyState, PageHeader, Pagination } from '@/components/ui';
import {
  batchStatusLabel,
  faNumber,
  fileTypeLabel,
  formatDateTime,
} from '@/lib/labels';
import { listImportBatches } from '@/lib/queries/imports';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImportsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(one(sp.page) ?? '1') || 1;
  const result = await listImportBatches(page);

  return (
    <div>
      <PageHeader title="تاریخچه ورود" description="batchهای ثبت‌شده در پایگاه داده" />

      {result.rows.length === 0 ? (
        <EmptyState message="هنوز batch ورودی وجود ندارد." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-line text-right text-muted">
                <th className="px-2 py-2 font-medium">فایل</th>
                <th className="px-2 py-2 font-medium">نوع</th>
                <th className="px-2 py-2 font-medium">وضعیت</th>
                <th className="px-2 py-2 font-medium">کل</th>
                <th className="px-2 py-2 font-medium">ایجاد</th>
                <th className="px-2 py-2 font-medium">رد شده</th>
                <th className="px-2 py-2 font-medium">بررسی</th>
                <th className="px-2 py-2 font-medium">زمان</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((batch) => (
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
                  <td className="px-2 py-3 tabular-nums">{faNumber(batch.createdRecords)}</td>
                  <td className="px-2 py-3 tabular-nums">{faNumber(batch.skippedRecords)}</td>
                  <td className="px-2 py-3 tabular-nums">{faNumber(batch.reviewRecords)}</td>
                  <td className="px-2 py-3 text-muted">{formatDateTime(batch.importedAt)}</td>
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
        basePath="/imports"
      />
    </div>
  );
}
