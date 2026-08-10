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
          className="ui-input !rounded-[1rem] !py-3 sm:!pl-28"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="ui-btn ui-btn-primary mt-3 w-full sm:absolute sm:left-2 sm:top-[1.7rem] sm:mt-0 sm:w-auto sm:!min-h-0 sm:px-4 sm:py-2"
      >
        {pending ? '…' : 'جستجو'}
      </button>
    </form>
  );
}
