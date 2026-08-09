import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { getSessionUser } from '@/lib/auth';

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md border-t-4 border-accent bg-elevated/90 px-6 py-8 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-muted">سامانه گمرکی</p>
        <h1 className="mt-2 text-3xl font-bold text-accent">متروکه</h1>
        <p className="mt-2 text-sm text-muted">ورود به داشبورد مدیریت کالاهای متروکه</p>
        <LoginForm />
      </div>
    </div>
  );
}
