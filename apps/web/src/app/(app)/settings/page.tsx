import { PageHeader } from '@/components/ui';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { getSessionUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <div>
      <PageHeader
        title="تنظیمات حساب"
        description="تغییر رمز عبور ورود به سامانه"
      />
      <div className="mb-6 rounded-xl border border-line bg-elevated/50 px-4 py-3 text-sm">
        <p>
          <span className="text-muted">نام کاربری: </span>
          <span className="font-medium">{user?.username}</span>
        </p>
        <p className="mt-1">
          <span className="text-muted">نام نمایشی: </span>
          <span className="font-medium">{user?.displayName}</span>
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
