'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function SearchBar({
  defaultValue = '',
  tab,
}: {
  defaultValue?: string;
  tab?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get('q') ?? '').trim();
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (tab && tab !== 'all') params.set('tab', tab);
        const href = params.toString() ? `/kootajs?${params}` : '/kootajs';
        startTransition(() => router.push(href));
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">جستجو</span>
        <input
          name="q"
          defaultValue={defaultValue}
          placeholder="شماره کوتاژ یا قبض انبار…"
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60 sm:absolute sm:left-2 sm:top-[1.65rem] sm:mt-0"
      >
        {pending ? '…' : 'جستجو'}
      </button>
    </form>
  );
}
