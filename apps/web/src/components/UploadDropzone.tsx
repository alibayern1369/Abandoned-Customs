'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function UploadDropzone() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    startTransition(async () => {
      try {
        const res = await fetch('/api/imports/upload', {
          method: 'POST',
          body: fd,
        });
        const data = (await res.json()) as {
          draftId?: string;
          batchId?: string;
          applied?: boolean;
          error?: string;
        };
        if (!res.ok || !data.draftId) {
          setError(data.error || 'آپلود ناموفق بود');
          return;
        }
        if (data.applied && data.batchId) {
          router.push(`/imports/${data.batchId}`);
          router.refresh();
          return;
        }
        router.push(`/imports/upload/${data.draftId}`);
      } catch {
        setError('خطا در ارتباط با سرور');
      }
    });
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
          dragOver
            ? 'border-accent bg-accent-soft'
            : 'border-line bg-surface hover:border-accent/40'
        }`}
      >
        <p className="text-lg font-semibold text-ink">فایل اکسل را اینجا رها کنید</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          ستون یکتا باید «کوتاژ» باشد. اطلاعات ناقص با آپلودهای بعدی و تأیید تداخل‌ها کامل می‌شود.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="mt-6 text-sm"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {pending ? <p className="mt-4 text-sm text-accent">در حال پردازش…</p> : null}
      </label>
      {error ? (
        <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
