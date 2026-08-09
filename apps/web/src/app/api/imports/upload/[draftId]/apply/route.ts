import { NextResponse } from 'next/server';
import { applyMergeDecisions, type FieldDecision, type MergeableParentField } from '@metrookeh/import-core';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type Body = {
  fieldDecisions?: Array<{
    normalizedKootaj: string;
    field: string;
    resolution: 'KEEP' | 'TAKE' | 'SKIP';
  }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'ورود لازم است' }, { status: 401 });
  }

  const { draftId } = await context.params;

  try {
    const body = (await request.json()) as Body;
    const fieldDecisions: FieldDecision[] = (body.fieldDecisions ?? []).map((d) => ({
      normalizedKootaj: d.normalizedKootaj,
      field: d.field as MergeableParentField,
      resolution: d.resolution,
    }));

    const result = await applyMergeDecisions({
      db: getDb(),
      draftId,
      fieldDecisions,
      createdBy: user.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'اعمال ادغام ناموفق بود';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
