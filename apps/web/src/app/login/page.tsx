import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { getSessionUser } from '@/lib/auth';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-strong w-full max-w-md rounded-[1.5rem] px-7 py-9 sm:px-8">
        <div className="mb-1 h-1 w-12 rounded-full bg-accent/80" />
        <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.14em] text-muted">سامانه گمرکی</p>
        <h1 className="mt-2 text-[2rem] font-bold tracking-tight text-accent">متروکه</h1>
        <p className="mt-2 text-sm leading-6 text-muted">ورود به داشبورد مدیریت کالاهای متروکه</p>
        <LoginForm />
      </div>
    </div>
  );
}
