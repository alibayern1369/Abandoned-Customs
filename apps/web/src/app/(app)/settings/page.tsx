import { PageHeader } from '@/components/ui';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { getSessionUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <div>
      <PageHeader title="تنظیمات حساب" description="تغییر رمز عبور ورود به سامانه" />
      <div className="glass mb-6 max-w-md rounded-[1.15rem] px-5 py-4 text-sm">
        <p>
          <span className="text-muted">نام کاربری: </span>
          <span className="font-medium">{user?.username}</span>
        </p>
        <p className="mt-1.5">
          <span className="text-muted">نام نمایشی: </span>
          <span className="font-medium">{user?.displayName}</span>
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
