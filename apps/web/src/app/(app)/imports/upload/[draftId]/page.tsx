import { notFound } from 'next/navigation';
import { getMergeDraft, type MergeReport } from '@metrookeh/import-core';
import { PageHeader } from '@/components/ui';
import { MergeConflictReview } from '@/components/MergeConflictReview';
import { getDb } from '@/lib/db';

export default async function MergeDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  const draft = await getMergeDraft(getDb(), draftId);
  if (!draft) notFound();

  const report = draft.report as MergeReport;

  return (
    <div>
      <PageHeader
        title="خلاصه ادغام اکسل"
        description={`فایل: ${draft.fileName} · نوع: ${report.fileType} · اکسل جدید برای فیلدهای متفاوت مرجع است`}
      />
      {draft.status !== 'AWAITING_RESOLUTION' ? (
        <p className="rounded-xl border border-blue-100 bg-accent-soft px-4 py-3 text-sm text-muted">
          این پیش‌نویس دیگر در انتظار تأیید نیست (وضعیت: {draft.status}).
        </p>
      ) : (
        <MergeConflictReview draftId={draftId} report={report} />
      )}
    </div>
  );
}
