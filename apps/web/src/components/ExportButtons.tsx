import Link from 'next/link';

export function ExportButtons({
  tab,
  q,
}: {
  tab?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (tab && tab !== 'all') params.set('tab', tab);
  if (q) params.set('q', q);
  const qs = params.toString();
  const excelHref = qs ? `/api/export/kootajs?${qs}` : '/api/export/kootajs';
  const printHref = qs ? `/kootajs/print?${qs}` : '/kootajs/print';

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={excelHref}
        className="rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm font-medium transition hover:border-accent hover:bg-accent-soft"
      >
        خروجی Excel
      </a>
      <Link
        href={printHref}
        target="_blank"
        className="rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm font-medium transition hover:border-accent hover:bg-accent-soft"
      >
        خروجی PDF / پرینت
      </Link>
    </div>
  );
}
