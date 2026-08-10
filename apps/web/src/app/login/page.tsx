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
          background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 48%, #f5f3ff 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-16 top-16 h-72 w-72 rounded-full bg-[#bfdbfe] opacity-70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-10 bottom-10 h-80 w-80 rounded-full bg-[#ddd6fe] opacity-60 blur-3xl"
      />

      <div className="relative w-full max-w-[420px] rounded-[24px] border border-line-soft bg-elevated p-8 shadow-panel">
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-[16px] shadow-[0_8px_24px_rgba(37,99,235,0.35)]"
          style={{ background: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)' }}
        >
          <svg
            width="32"
            height="32"
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
        <p className="text-xs font-medium tracking-wide text-muted">سامانه گمرکی</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">متروکه</h1>
        <p className="mt-2 text-sm text-muted">ورود به داشبورد مدیریت کالاهای متروکه</p>
        <LoginForm />
      </div>
    </div>
  );
}
