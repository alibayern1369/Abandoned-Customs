import { NextResponse } from 'next/server';
import XLSX from 'xlsx';
import { isExited } from '@metrookeh/domain';
import { getSessionUser } from '@/lib/auth';
import {
  listKootajsForExport,
  parseKootajTab,
} from '@/lib/queries/kootajs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'ورود لازم است' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? undefined;
  const tab = parseKootajTab(url.searchParams.get('tab') ?? undefined);

  const { rows } = await listKootajsForExport({ q, tab });

  const sheetRows = rows.map((row) => ({
    کوتاژ: row.displayKootaj || row.normalizedKootaj,
    'کوتاژ نرمال': row.normalizedKootaj,
    'قبض انبار': row.warehouseReceipts ?? '',
    منبع: row.sourceOrigin,
    مالک: row.ownerName?.trim() || 'سازمان اموال تملیکی',
    'ثبت سفارش': row.orderRegistrationNo ?? '',
    نامه: row.letterNumber ?? '',
    'تاریخ نامه': row.letterDate ?? '',
    'وضعیت کالا': row.goodsStatusText ?? '',
    خروج: row.exitText?.trim() || 'خارج نشده',
    'خارج‌شده': isExited(row.exitText) ? 'بله' : 'خیر',
    ناقص: row.isIncomplete ? 'بله' : 'خیر',
    تکمیل: row.isComplete ? 'بله' : 'خیر',
    'بررسی باز': Number(row.openReviewCount),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'کوتاژها');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const filename = `kootajs-${tab}-${Date.now()}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
