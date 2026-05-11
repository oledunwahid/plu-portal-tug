import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatchById, markRequestBatchDone } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await getRequestBatchById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'DONE') return NextResponse.json({ error: 'Already marked as done' }, { status: 409 });

    const result = await markRequestBatchDone(params.id);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ...result.batch, itemCount: result.itemCount });
  } catch (error) {
    console.error('[POST /api/admin/batches/:id/done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
