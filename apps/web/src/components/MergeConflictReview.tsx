'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { MergeReport } from '@metrookeh/import-core';
import { Badge } from '@/components/ui';
import { faNumber } from '@/lib/labels';

type ApplyResult = {
  batchId: string;
  created: number;
  updated: number;
  itemsCreated: number;
  updatedKootajs: string[];
};

const PREVIEW_LIMIT = 60;

export function MergeConflictReview({
  draftId,
  report,
}: {
  draftId: string;
  report: MergeReport;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const creates = report.kootajs.filter((e) => e.kind === 'CREATE');
  const willUpdate = report.kootajs.filter(
    (e) => e.kind === 'UPDATE' && e.fields.length > 0,
  );
  const letterConflicts = report.letters.filter((letter) => letter.kind === 'CONFLICT');

  function apply() {
    setError(null);
    startTransition(async () => {
      // Empty decisions → server uses suggested TAKE (Excel is source of truth).
      const res = await fetch(`/api/imports/upload/${draftId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldDecisions: [] }),
      });
      const data = (await res.json()) as ApplyResult & { error?: string };
      if (!res.ok) {
        setError(data.error || 'اعمال ادغام ناموفق بود');
        return;
      }
      setResult({
        batchId: data.batchId,
        created: data.created,
        updated: data.updated,
        itemsCreated: data.itemsCreated,
        updatedKootajs: data.updatedKootajs ?? [],
      });
    });
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-ink">
          <p className="font-semibold text-ok">ادغام با موفقیت اعمال شد</p>
          <p className="mt-1 text-muted">
            جدید: {faNumber(result.created)} · به‌روزرسانی: {faNumber(result.updated)} · اقلام
            اضافه‌شده: {faNumber(result.itemsCreated)}
          </p>
        </div>

        {result.updatedKootajs.length > 0 ? (
          <section className="rounded-2xl border border-line bg-elevated p-4 shadow-panel">
            <h3 className="mb-2 font-semibold">
              این کوتاژها آپدیت شدند ({faNumber(result.updatedKootajs.length)})
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.updatedKootajs.slice(0, PREVIEW_LIMIT).map((key) => (
                <Badge key={key}>{key}</Badge>
              ))}
              {result.updatedKootajs.length > PREVIEW_LIMIT ? (
                <span className="text-xs text-muted">
                  و {faNumber(result.updatedKootajs.length - PREVIEW_LIMIT)} مورد دیگر…
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="text-sm text-muted">هیچ کوتاژ موجودی از نظر فیلد والد به‌روز نشد.</p>
        )}

        <Link
          href={`/imports/${result.batchId}`}
          className="inline-flex rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          مشاهده نتیجه ایمپورت
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-accent-soft px-4 py-3 text-sm text-muted">
        اگر اکسل جدید برای یک کوتاژ موجود مقدار متفاوتی داشته باشد،{' '}
        <span className="font-medium text-ink">اکسل جدید مرجع است</span> و بدون بررسی فیلدبه‌فیلد
        اعمال می‌شود.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="کوتاژ جدید" value={report.summary.create} />
        <SummaryCard label="به‌روزرسانی از اکسل" value={willUpdate.length} />
        <SummaryCard label="فیلدهای پرشدنی" value={report.summary.fillFields} />
        <SummaryCard label="فیلدهای جایگزین" value={report.summary.conflictFields} />
      </div>

      {report.letters.length > 0 ? (
        <section className="rounded-2xl border border-line bg-elevated p-4 shadow-panel">
          <h3 className="mb-2 font-semibold">نامه‌ها</h3>
          <p className="text-sm text-muted">
            الصاق: {faNumber(report.summary.lettersAttach)} · تعارض:{' '}
            {faNumber(report.summary.lettersConflict)} · بدون تطبیق:{' '}
            {faNumber(report.summary.lettersUnmatched)}
          </p>
          {letterConflicts.length > 0 ? (
            <p className="mt-2 text-sm text-warn">
              تعارض شماره نامه همچنان برای بررسی ثبت می‌شود و نامه قبلی جایگزین نمی‌شود.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {report.letters
              .filter((letter) => letter.kind !== 'SKIP')
              .slice(0, PREVIEW_LIMIT)
              .map((letter, idx) => (
                <li key={idx} className="rounded-xl bg-surface px-3 py-2">
                  <Badge
                    tone={
                      letter.kind === 'CONFLICT'
                        ? 'warn'
                        : letter.kind === 'UNMATCHED'
                          ? 'danger'
                          : 'ok'
                    }
                  >
                    {letter.kind}
                  </Badge>{' '}
                  {letter.normalizedKootaj || '—'} · {letter.incoming.letterNumber} ·{' '}
                  {letter.reason}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {creates.length > 0 ? (
        <section className="rounded-2xl border border-line bg-elevated p-4 shadow-panel">
          <h3 className="mb-2 font-semibold">کوتاژهای جدید ({faNumber(creates.length)})</h3>
          <div className="flex flex-wrap gap-2">
            {creates.slice(0, PREVIEW_LIMIT).map((c) => (
              <Badge key={c.normalizedKootaj}>{c.displayKootaj || c.normalizedKootaj}</Badge>
            ))}
            {creates.length > PREVIEW_LIMIT ? (
              <span className="text-xs text-muted">
                و {faNumber(creates.length - PREVIEW_LIMIT)} مورد دیگر…
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {willUpdate.length > 0 ? (
        <section className="rounded-2xl border border-line bg-elevated p-4 shadow-panel">
          <h3 className="mb-2 font-semibold">
            کوتاژهایی که از اکسل آپدیت می‌شوند ({faNumber(willUpdate.length)})
          </h3>
          <p className="mb-3 text-sm text-muted">
            فیلدهای خالی پر می‌شوند و مقادیر متفاوت با اکسل جدید جایگزین می‌گردند.
          </p>
          <div className="flex flex-wrap gap-2">
            {willUpdate.slice(0, PREVIEW_LIMIT).map((entry) => (
              <Badge key={entry.normalizedKootaj}>
                {entry.displayKootaj || entry.normalizedKootaj}
              </Badge>
            ))}
            {willUpdate.length > PREVIEW_LIMIT ? (
              <span className="text-xs text-muted">
                و {faNumber(willUpdate.length - PREVIEW_LIMIT)} مورد دیگر…
              </span>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="text-sm text-ok">کوتاژ موجودی برای به‌روزرسانی فیلد ندارد.</p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={apply}
        className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'در حال اعمال…' : 'تأیید و اعمال ادغام'}
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-elevated px-4 py-3 shadow-panel">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-accent">{faNumber(value)}</p>
    </div>
  );
}
