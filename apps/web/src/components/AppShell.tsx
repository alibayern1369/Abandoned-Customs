'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions';

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

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface p-3 sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1440px] flex-col overflow-hidden rounded-[24px] border border-line-soft bg-elevated shadow-panel sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-3rem)] lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col border-b border-line bg-surface lg:border-b-0 lg:border-l">
          <div className="px-5 py-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-bright to-accent-hover shadow-[0_6px_16px_rgba(37,99,235,0.28)]">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
                <path d="M12 12v8" />
                <path d="M4 8.5 12 12l8-3.5" />
              </svg>
            </div>
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-faint">سامانه گمرکی</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">متروکه</h1>
            <p className="mt-2 text-sm leading-6 text-muted">مدیریت کوتاژهای متروکه</p>
          </div>
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
          <div className="mt-auto hidden border-t border-line px-5 py-4 lg:block">
            <p className="text-sm font-medium text-ink">{user.displayName}</p>
            <p className="text-xs text-muted">
              {user.username} · {user.role}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href="/settings"
                className="text-sm text-accent underline-offset-2 hover:underline"
              >
                تغییر رمز
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-sm text-danger underline-offset-2 hover:underline"
                >
                  خروج
                </button>
              </form>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col bg-elevated">
          <header className="flex items-center justify-between border-b border-line bg-elevated px-4 py-3 lg:hidden">
            <div>
              <p className="text-sm font-semibold">{user.displayName}</p>
              <p className="text-xs text-muted">{user.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings" className="text-sm text-accent">
                رمز
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-sm text-danger">
                  خروج
                </button>
              </form>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
