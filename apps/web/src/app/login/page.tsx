import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { getSessionUser } from '@/lib/auth';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 42% at 18% 22%, rgba(56,150,120,0.35), transparent 60%), radial-gradient(ellipse 46% 40% at 84% 78%, rgba(72,130,180,0.32), transparent 58%)',
        }}
      />
      <div className="glass-strong relative w-full max-w-md rounded-[1.75rem] px-7 py-9 sm:px-8">
        <div className="mb-1 h-1.5 w-14 rounded-full bg-accent/85" />
        <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.14em] text-muted">سامانه گمرکی</p>
        <h1 className="mt-2 text-[2.1rem] font-bold tracking-tight text-accent">متروکه</h1>
        <p className="mt-2 text-sm leading-6 text-muted">ورود به داشبورد مدیریت کالاهای متروکه</p>
        <LoginForm />
      </div>
    </div>
  );
}
