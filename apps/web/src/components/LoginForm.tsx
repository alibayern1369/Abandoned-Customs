'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">نام کاربری</span>
        <input
          name="username"
          autoComplete="username"
          defaultValue="admin"
          className="w-full rounded-md border border-line bg-elevated px-3 py-2 outline-none focus:border-accent"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">رمز عبور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-elevated px-3 py-2 outline-none focus:border-accent"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'در حال ورود…' : 'ورود'}
      </button>
    </form>
  );
}
