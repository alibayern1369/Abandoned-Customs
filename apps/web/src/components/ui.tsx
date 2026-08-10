import Link from 'next/link';
import { faNumber } from '@/lib/labels';

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-7">
      <h2 className="text-[1.65rem] font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h2>
      {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
    </div>
  );
}

export function StatLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="glass group block rounded-[1.35rem] px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(35,55,70,0.14)]"
    >
      <p className="text-sm text-muted transition group-hover:text-ink/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-accent">{faNumber(value)}</p>
    </Link>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="glass-inset rounded-[1.05rem] border border-dashed border-line/80 px-5 py-12 text-center text-sm text-muted">
      {message}
    </p>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value);
    }
    params.set('page', String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        صفحه {faNumber(page)} از {faNumber(totalPages)} · {faNumber(total)} مورد
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="ui-btn ui-btn-secondary !min-h-0 px-3.5 py-1.5">
            قبلی
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)} className="ui-btn ui-btn-secondary !min-h-0 px-3.5 py-1.5">
            بعدی
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  const tones = {
    neutral: 'bg-accent-soft text-accent ring-accent/10',
    ok: 'bg-emerald-50/90 text-ok ring-emerald-200/60',
    warn: 'bg-amber-50/90 text-warn ring-amber-200/60',
    danger: 'bg-rose-50/90 text-danger ring-rose-200/60',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[0.7rem] font-semibold tracking-tight ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
