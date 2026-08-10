'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">نام کاربری</span>
        <input
          name="username"
          autoComplete="username"
          defaultValue="admin"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">رمز عبور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          required
        />
      </label>
      {state?.error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'در حال ورود…' : 'ورود'}
      </button>
    </form>
  );
}
