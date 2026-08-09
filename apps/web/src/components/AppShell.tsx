import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions';

const NAV = [
  { href: '/', label: 'خلاصه' },
  { href: '/kootajs', label: 'کوتاژهای متروکه' },
  { href: '/imports/upload', label: 'آپلود اکسل' },
  { href: '/reviews', label: 'صف بررسی' },
  { href: '/imports', label: 'تاریخچه ورود' },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-b border-line bg-elevated/95 backdrop-blur lg:border-b-0 lg:border-l">
        <div className="px-5 py-6">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted">سامانه گمرکی</p>
          <h1 className="mt-1 font-[family-name:var(--font-sans)] text-3xl font-bold tracking-tight text-accent">
            متروکه
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">مدیریت کوتاژهای متروکه</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-soft"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-line px-5 py-4 lg:block">
          <p className="text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-muted">
            {user.username} · {user.role}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="text-sm text-danger underline-offset-2 hover:underline"
            >
              خروج
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-elevated/70 px-4 py-3 lg:hidden">
          <div>
            <p className="text-sm font-semibold">{user.displayName}</p>
            <p className="text-xs text-muted">{user.role}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-danger">
              خروج
            </button>
          </form>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
