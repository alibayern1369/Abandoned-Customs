'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="glass max-w-md space-y-4 rounded-[1.25rem] p-5 sm:p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">رمز فعلی</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="ui-input"
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
          className="ui-input"
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
          className="ui-input"
          required
        />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-ok">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="ui-btn ui-btn-primary">
        {pending ? 'در حال ذخیره…' : 'تغییر رمز عبور'}
      </button>
    </form>
  );
}
