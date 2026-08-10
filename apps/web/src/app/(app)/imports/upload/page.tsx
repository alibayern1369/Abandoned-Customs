import { PageHeader } from '@/components/ui';
import { UploadDropzone } from '@/components/UploadDropzone';

export default function UploadPage() {
  return (
    <div>
      <PageHeader
        title="آپلود اکسل"
        description="فایل را بارگذاری کنید؛ سیستم بر اساس ستون کوتاژ رکوردها را ایجاد یا تکمیل می‌کند و تداخل‌ها را برای تأیید نشان می‌دهد."
      />
      <UploadDropzone />
      <div className="mt-6 rounded-2xl border border-blue-100 bg-accent-soft p-4 text-sm text-muted">
        <p className="font-medium text-ink">نکات</p>
        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>کلید یکتا ستون «کوتاژ» است (یا شماره کوتاژ / مجوز بارگیری در فایل‌های استاندارد).</li>
          <li>فیلدهای خالی به‌صورت پیشنهادی از اکسل جدید پر می‌شوند.</li>
          <li>اگر مقدار فعلی و اکسل متفاوت باشند، قبل از ذخیره باید انتخاب کنید.</li>
          <li>
            ستون «تاریخ اعلام به اموال تملیکی» اگر شماره نامه داشته باشد (مثل{' '}
            <span className="font-mono text-ink" dir="ltr">
              1403/1386642
            </span>
            ) کوتاژ را نامه‌دار می‌کند؛ فقط تاریخ یا متن ناقص بدون شماره = بدون نامه، و در آپلود بعدی با دیدن شماره تکمیل می‌شود.
          </li>
        </ul>
      </div>
    </div>
  );
}
