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
      <a href={excelHref} className="ui-btn ui-btn-secondary">
        خروجی Excel
      </a>
      <Link href={printHref} target="_blank" className="ui-btn ui-btn-secondary">
        خروجی PDF / پرینت
      </Link>
    </div>
  );
}
