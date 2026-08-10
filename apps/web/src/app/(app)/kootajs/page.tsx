import { EmptyState, PageHeader, Pagination } from '@/components/ui';
import { KootajCard } from '@/components/KootajCard';
import { StatusTabs } from '@/components/StatusTabs';
import { SearchBar } from '@/components/SearchBar';
import { ExportButtons } from '@/components/ExportButtons';
import { faNumber } from '@/lib/labels';
import {
  getTabCounts,
  listKootajs,
  parseKootajTab,
} from '@/lib/queries/kootajs';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function KootajsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? '';
  const tab = parseKootajTab(one(sp.tab));
  const page = Number(one(sp.page) ?? '1') || 1;

  const [result, counts] = await Promise.all([
    listKootajs({
      q: q || undefined,
      tab,
      page,
    }),
    getTabCounts(q || undefined),
  ]);

  const query = {
    q: q || undefined,
    tab: tab !== 'all' ? tab : undefined,
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="کوتاژهای متروکه"
          description="مشاهده، دسته‌بندی و جستجوی همه کوتاژها با داده کامل."
        />
        <ExportButtons tab={tab} q={q || undefined} />
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-elevated p-4 shadow-panel sm:p-5">
        <SearchBar defaultValue={q} tab={tab} />
      </div>

      <StatusTabs active={tab} counts={counts} q={q || undefined} />

      <p className="mb-4 text-sm text-muted">
        {faNumber(result.total)} مورد در این دسته
      </p>

      {result.rows.length === 0 ? (
        <EmptyState message="کوتاژی با این فیلتر پیدا نشد." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((row) => (
            <KootajCard key={row.id} row={row} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/kootajs"
        query={query}
      />
    </div>
  );
}
