import Link from 'next/link';
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

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_1fr]">
      <aside className="glass-nav border-b border-line/70 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-l lg:border-line/70">
        <div className="flex h-full flex-col">
          <div className="px-5 py-7">
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted">سامانه گمرکی</p>
            <h1 className="mt-1.5 text-[1.85rem] font-bold leading-none tracking-tight text-accent">
              متروکه
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-muted">مدیریت کوتاژهای متروکه</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-[0.9rem] px-3.5 py-2.5 text-sm font-medium text-ink/90 transition hover:bg-white/55 hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden border-t border-line/70 px-5 py-5 lg:block">
            <p className="text-sm font-semibold tracking-tight">{user.displayName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {user.username} · {user.role}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <Link
                href="/settings"
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                تغییر رمز
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-sm font-medium text-danger underline-offset-4 hover:underline"
                >
                  خروج
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="glass-nav flex items-center justify-between border-b border-line/70 px-4 py-3.5 lg:hidden">
          <div>
            <p className="text-sm font-semibold tracking-tight">{user.displayName}</p>
            <p className="text-xs text-muted">{user.role}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm font-medium text-accent">
              رمز
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="text-sm font-medium text-danger">
                خروج
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-9 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
