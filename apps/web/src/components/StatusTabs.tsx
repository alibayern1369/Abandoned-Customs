import Link from 'next/link';
import { faNumber } from '@/lib/labels';
import type { KootajTab, TabCounts } from '@/lib/queries/kootajs';

const TAB_META: Array<{ id: KootajTab; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'complete', label: 'تکمیل‌شده' },
  { id: 'with_letter', label: 'با نامه' },
  { id: 'without_letter', label: 'بدون نامه' },
  { id: 'exited', label: 'خارج‌شده' },
  { id: 'not_exited', label: 'خارج‌نشده' },
  { id: 'incomplete', label: 'ناقص' },
  { id: 'needs_review', label: 'نیاز به بررسی' },
];

export function StatusTabs({
  active,
  counts,
  q,
}: {
  active: KootajTab;
  counts: TabCounts;
  q?: string;
}) {
  return (
    <div className="mb-6 -mx-1 overflow-x-auto pb-1">
      <div className="glass inline-flex min-w-max gap-1 rounded-[1.15rem] p-1.5">
        {TAB_META.map((tab) => {
          const params = new URLSearchParams();
          if (tab.id !== 'all') params.set('tab', tab.id);
          if (q) params.set('q', q);
          const href = params.toString() ? `/kootajs?${params}` : '/kootajs';
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`rounded-[0.85rem] px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-accent text-white shadow-[0_4px_12px_rgba(36,107,82,0.22)]'
                  : 'text-muted hover:bg-white/55 hover:text-ink'
              }`}
            >
              {tab.label}
              <span className={`mr-1.5 tabular-nums ${isActive ? 'text-white/80' : 'text-muted'}`}>
                {faNumber(counts[tab.id] ?? 0)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
