'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MergeReport } from '@metrookeh/import-core';
import { Badge } from '@/components/ui';
import { faNumber } from '@/lib/labels';

type Resolution = 'KEEP' | 'TAKE' | 'SKIP';

export function MergeConflictReview({
  draftId,
  report,
}: {
  draftId: string;
  report: MergeReport;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(() => {
    const map: Record<string, Resolution> = {};
    for (const entry of report.kootajs) {
      for (const field of entry.fields) {
        map[`${entry.normalizedKootaj}::${field.field}`] = field.suggested;
      }
    }
    return map;
  }, [report]);

  const [decisions, setDecisions] = useState(initial);

  const conflictEntries = report.kootajs.filter((e) => e.fields.some((f) => f.action === 'CONFLICT'));
  const fillOnly = report.kootajs.filter(
    (e) => e.kind === 'UPDATE' && e.fillCount > 0 && e.conflictCount === 0,
  );
  const creates = report.kootajs.filter((e) => e.kind === 'CREATE');

  function apply() {
    setError(null);
    startTransition(async () => {
      const fieldDecisions = Object.entries(decisions).map(([key, resolution]) => {
        const [normalizedKootaj, field] = key.split('::');
        return { normalizedKootaj, field, resolution };
      });

      const res = await fetch(`/api/imports/upload/${draftId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldDecisions }),
      });
      const data = (await res.json()) as { batchId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || 'اعمال ادغام ناموفق بود');
        return;
      }
      router.push(data.batchId ? `/imports/${data.batchId}` : '/imports');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="کوتاژ جدید" value={report.summary.create} />
        <SummaryCard label="به‌روزرسانی" value={report.summary.update} />
        <SummaryCard label="فیلدهای پرشدنی" value={report.summary.fillFields} />
        <SummaryCard label="تداخل فیلد" value={report.summary.conflictFields} tone="warn" />
      </div>

      {report.letters.length > 0 ? (
        <section className="glass rounded-[1.25rem] p-5">
          <h3 className="mb-2 font-semibold tracking-tight">نامه‌ها</h3>
          <p className="text-sm text-muted">
            الصاق: {faNumber(report.summary.lettersAttach)} · تعارض:{' '}
            {faNumber(report.summary.lettersConflict)} · بدون تطبیق:{' '}
            {faNumber(report.summary.lettersUnmatched)}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {report.letters
              .filter((letter) => letter.kind !== 'SKIP')
              .map((letter, idx) => (
                <li key={idx} className="glass-inset rounded-[0.9rem] px-3.5 py-2.5">
                  <Badge
                    tone={
                      letter.kind === 'CONFLICT' ? 'warn' : letter.kind === 'UNMATCHED' ? 'danger' : 'ok'
                    }
                  >
                    {letter.kind}
                  </Badge>{' '}
                  {letter.normalizedKootaj || '—'} · {letter.incoming.letterNumber} · {letter.reason}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {creates.length > 0 ? (
        <section className="glass rounded-[1.25rem] p-5">
          <h3 className="mb-2 font-semibold tracking-tight">کوتاژهای جدید ({faNumber(creates.length)})</h3>
          <div className="flex flex-wrap gap-2">
            {creates.slice(0, 40).map((c) => (
              <Badge key={c.normalizedKootaj}>{c.displayKootaj || c.normalizedKootaj}</Badge>
            ))}
            {creates.length > 40 ? <span className="text-xs text-muted">و بیشتر…</span> : null}
          </div>
        </section>
      ) : null}

      {fillOnly.length > 0 ? (
        <section className="glass rounded-[1.25rem] p-5">
          <h3 className="mb-2 font-semibold tracking-tight">
            تکمیل خودکار فیلدهای خالی ({faNumber(fillOnly.length)})
          </h3>
          <p className="text-sm text-muted">به‌صورت پیش‌فرض از اکسل پر می‌شوند مگر رد کنید.</p>
        </section>
      ) : null}

      {conflictEntries.length === 0 && report.summary.conflictFields === 0 ? (
        <p className="glass-inset rounded-[1rem] px-4 py-3 text-sm text-ok">
          تداخل فیلدی وجود ندارد؛ می‌توانید ادغام را تأیید کنید.
        </p>
      ) : (
        <section className="space-y-4">
          <h3 className="font-semibold tracking-tight">تداخل‌ها — برای هر فیلد انتخاب کنید</h3>
          {conflictEntries.map((entry) => (
            <div key={entry.normalizedKootaj} className="glass rounded-[1.25rem] p-5">
              <p className="mb-3 text-base font-bold tracking-tight">
                {entry.displayKootaj || entry.normalizedKootaj}
              </p>
              <div className="space-y-3">
                {entry.fields
                  .filter((f) => f.action === 'CONFLICT' || f.action === 'FILL')
                  .map((field) => {
                    const key = `${entry.normalizedKootaj}::${field.field}`;
                    return (
                      <div key={key} className="glass-inset rounded-[1rem] p-3.5">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          <Badge tone={field.action === 'CONFLICT' ? 'warn' : 'ok'}>
                            {field.action === 'CONFLICT' ? 'تداخل' : 'خالی'}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <p>
                            <span className="text-muted">فعلی: </span>
                            {field.existing || '—'}
                          </p>
                          <p>
                            <span className="text-muted">اکسل: </span>
                            {field.incoming || '—'}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(
                            [
                              ['KEEP', 'نگه داشتن فعلی'],
                              ['TAKE', 'گرفتن از اکسل'],
                              ['SKIP', 'رد کردن'],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setDecisions((prev) => ({ ...prev, [key]: value }))}
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                decisions[key] === value
                                  ? 'bg-accent text-white shadow-[0_4px_12px_rgba(36,107,82,0.2)]'
                                  : 'bg-white/60 text-muted hover:bg-white/90 hover:text-ink'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </section>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button type="button" disabled={pending} onClick={apply} className="ui-btn ui-btn-primary px-6">
        {pending ? 'در حال اعمال…' : 'تأیید و اعمال ادغام'}
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn';
}) {
  return (
    <div className="glass rounded-[1.15rem] px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${
          tone === 'warn' ? 'text-warn' : 'text-accent'
        }`}
      >
        {faNumber(value)}
      </p>
    </div>
  );
}
