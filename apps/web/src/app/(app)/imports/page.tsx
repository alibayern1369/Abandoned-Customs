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
        <div className="ui-table-wrap">
          <table className="ui-table min-w-[48rem]">
            <thead>
              <tr>
                <th>فایل</th>
                <th>نوع</th>
                <th>وضعیت</th>
                <th>کل</th>
                <th>ایجاد</th>
                <th>رد شده</th>
                <th>بررسی</th>
                <th>زمان</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((batch) => (
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
                  <td className="tabular-nums">{faNumber(batch.createdRecords)}</td>
                  <td className="tabular-nums">{faNumber(batch.skippedRecords)}</td>
                  <td className="tabular-nums">{faNumber(batch.reviewRecords)}</td>
                  <td className="text-muted">{formatDateTime(batch.importedAt)}</td>
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
