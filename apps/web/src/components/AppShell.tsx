import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions';
import { SideNav } from '@/components/SideNav';

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
    <div className="app-stage">
      <aside className="glass-nav border-b border-white/50 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:rounded-[1.6rem] lg:border">
        <div className="flex h-full flex-col">
          <div className="px-5 py-7">
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted">سامانه گمرکی</p>
            <h1 className="mt-1.5 text-[1.9rem] font-bold leading-none tracking-tight text-accent">
              متروکه
            </h1>
            <p className="mt-2.5 text-sm leading-6 text-muted">مدیریت کوتاژهای متروکه</p>
          </div>
          <SideNav items={NAV} />
          <div className="mt-auto hidden border-t border-white/45 px-5 py-5 lg:block">
            <div className="glass-inset rounded-[1rem] px-3.5 py-3">
              <p className="text-sm font-semibold tracking-tight">{user.displayName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {user.username} · {user.role}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
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
        </div>
      </aside>
      <div className="min-w-0 lg:min-h-[calc(100vh-2rem)]">
        <header className="glass-nav flex items-center justify-between border-b border-white/50 px-4 py-3.5 lg:hidden">
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
        <main className="min-h-full px-4 py-7 sm:px-6 lg:rounded-[1.6rem] lg:px-5 lg:py-5 xl:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
