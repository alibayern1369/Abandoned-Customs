'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'خلاصه' },
  { href: '/kootajs', label: 'کوتاژهای متروکه' },
  { href: '/imports/upload', label: 'آپلود اکسل' },
  { href: '/reviews', label: 'صف بررسی' },
  { href: '/imports', label: 'تاریخچه ورود' },
  { href: '/settings', label: 'تنظیمات / رمز عبور' },
] as const;

function navActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
      {NAV.map((item) => {
        const active = navActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-accent-soft text-accent ring-1 ring-inset ring-blue-200'
                : 'text-ink hover:bg-accent-soft/70'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
