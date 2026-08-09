'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">رمز فعلی</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-elevated px-3 py-2 outline-none focus:border-accent"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">رمز جدید</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md border border-line bg-elevated px-3 py-2 outline-none focus:border-accent"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">تکرار رمز جدید</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="w-full rounded-md border border-line bg-elevated px-3 py-2 outline-none focus:border-accent"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-ok">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'در حال ذخیره…' : 'تغییر رمز عبور'}
      </button>
    </form>
  );
}
