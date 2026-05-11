import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestByIdSimple, updatePLURequest } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await getPLURequestByIdSimple(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'DONE') return NextResponse.json({ error: 'Already marked as done' }, { status: 409 });

    const updated = await updatePLURequest(params.id, {
      status: 'DONE',
      doneAt: new Date().toISOString(),
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[POST /api/admin/requests/:id/done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
