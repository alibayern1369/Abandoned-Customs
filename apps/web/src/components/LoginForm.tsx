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
          className="ui-input"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">رمز عبور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="ui-input"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="ui-btn ui-btn-primary w-full">
        {pending ? 'در حال ورود…' : 'ورود'}
      </button>
    </form>
  );
}
