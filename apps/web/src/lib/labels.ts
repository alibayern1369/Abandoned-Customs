export function faNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

export { isExited } from '@metrookeh/domain';

/** Display label for exit column — keep raw date/ref when exited. */
export function exitDisplay(exitText: string | null | undefined): string {
  const text = (exitText ?? '').trim();
  if (!text) return 'خارج نشده';
  return text;
}

/** Exact amount in Rials with thousand separators (every 3 digits), Persian digits. */
export function formatRial(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  let raw = String(value).trim();
  if (raw === '') return '—';

  raw = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/,/g, '')
    .replace(/٬/g, '')
    .replace(/\s/g, '');

  const negative = raw.startsWith('-');
  if (negative) raw = raw.slice(1);

  if (!/^\d+(\.\d+)?$/.test(raw)) return faNumber(value);

  const [intRaw, fracRaw] = raw.split('.');
  const intPart = (intRaw ?? '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const keepFrac = fracRaw != null && /[1-9]/.test(fracRaw);
  const withFrac = keepFrac ? `${grouped}.${fracRaw.replace(/0+$/, '')}` : grouped;
  return faNumber(negative ? `-${withFrac}` : withFrac);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function reviewTypeLabel(type: string): string {
  switch (type) {
    case 'EXTRACTION_FAILED':
      return 'استخراج ناموفق';
    case 'UNMATCHED':
      return 'بدون تطبیق';
    case 'LETTER_CONFLICT':
      return 'تعارض نامه';
    case 'PARENT_FIELD_CONFLICT':
      return 'تعارض فیلد والد';
    default:
      return type;
  }
}

export function reviewStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'باز';
    case 'RESOLVED':
      return 'حل‌شده';
    case 'IGNORED':
      return 'نادیده';
    default:
      return status;
  }
}

export function batchStatusLabel(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'در حال اجرا';
    case 'COMPLETED':
      return 'تمام‌شده';
    case 'COMPLETED_WITH_REVIEW':
      return 'تمام با بررسی';
    case 'FAILED':
      return 'ناموفق';
    default:
      return status;
  }
}

export function fileTypeLabel(type: string): string {
  switch (type) {
    case 'FILE1':
      return 'فایل ۱';
    case 'FILE2':
      return 'فایل ۲';
    case 'FILE3':
      return 'فایل ۳';
    default:
      return type;
  }
}

export function sourceOriginLabel(origin: string): string {
  switch (origin) {
    case 'FILE1':
      return 'فایل ۱';
    case 'FILE2':
      return 'فایل ۲ (جدید)';
    default:
      return origin;
  }
}
