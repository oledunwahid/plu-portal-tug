import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestByIdSimple, updatePLURequest, deletePLURequest } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const record = await getPLURequestByIdSimple(params.id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (record.requestType !== 'REMOVE_PLU') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && record.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(record);
  } catch (err) {
    console.error('[GET /api/removal/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const record = await getPLURequestByIdSimple(params.id);
    if (!record || record.requestType !== 'REMOVE_PLU') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Parameters<typeof updatePLURequest>[1] = { updatedBy: session.user.name };
    if ('adminNote' in body) updates.adminNote = body.adminNote ?? null;
    if (body.status === 'DONE' && record.status !== 'DONE') {
      updates.status = 'DONE';
      updates.doneAt = new Date().toISOString();
    }

    const updated = await updatePLURequest(params.id, updates);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/removal/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const record = await getPLURequestByIdSimple(params.id);
    if (!record || record.requestType !== 'REMOVE_PLU') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const deleted = await deletePLURequest(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/removal/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
