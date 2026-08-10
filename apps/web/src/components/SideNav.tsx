'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isActive(pathname: string, href: string, allHrefs: readonly string[]) {
  if (href === '/') return pathname === '/';
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

export function SideNav({
  items,
}: {
  items: ReadonlyArray<{ href: string; label: string }>;
}) {
  const pathname = usePathname();
  const hrefs = items.map((item) => item.href);

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href, hrefs);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-[0.95rem] px-3.5 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-accent text-white shadow-[0_8px_18px_rgba(31,109,84,0.24)]'
                : 'text-ink/85 hover:bg-white/50 hover:text-accent'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
