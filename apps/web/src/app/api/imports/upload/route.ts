import { NextResponse } from 'next/server';
import {
  buildMergeReportFromBuffer,
  createMergeDraft,
} from '@metrookeh/import-core';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'ورود لازم است' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایل ارسال نشده است' }, { status: 400 });
    }

    const name = file.name || 'upload.xlsx';
    if (!/\.(xlsx|xls)$/i.test(name)) {
      return NextResponse.json({ error: 'فقط فایل اکسل مجاز است' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const db = getDb();
    const report = await buildMergeReportFromBuffer({
      db,
      buffer,
      fileName: name,
    });

    if (report.kootajs.length === 0 && report.letters.length === 0) {
      return NextResponse.json(
        { error: 'هیچ رکورد معتبری با ستون کوتاژ در فایل پیدا نشد' },
        { status: 400 },
      );
    }

    const { draftId } = await createMergeDraft({
      db,
      report,
      createdBy: user.id,
    });

    return NextResponse.json({ draftId, summary: report.summary, fileType: report.fileType });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته در پردازش فایل';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
