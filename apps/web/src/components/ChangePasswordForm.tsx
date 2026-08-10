'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/actions';

const fieldClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">رمز فعلی</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className={fieldClass}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">رمز جدید</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={fieldClass}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">تکرار رمز جدید</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={fieldClass}
          required
        />
      </label>
      {state?.error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="success-pulse rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-ok">
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'در حال ذخیره…' : 'تغییر رمز عبور'}
      </button>
    </form>
  );
}
