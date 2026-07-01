import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getReconcileSessionById, getReconcileRows, getReconcileSubGroups } from '@/lib/db';
import { parseReconcileRowFilters } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reconcileSession = await getReconcileSessionById(params.sessionId);
    if (!reconcileSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const filters = parseReconcileRowFilters(new URL(req.url).searchParams);
    const [rows, subGroups] = await Promise.all([
      getReconcileRows(params.sessionId, filters),
      getReconcileSubGroups(params.sessionId),
    ]);

    return NextResponse.json({ session: reconcileSession, rows, subGroups });
  } catch (err) {
    console.error('[GET /api/admin/kb/reconcile/[sessionId]/rows]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
