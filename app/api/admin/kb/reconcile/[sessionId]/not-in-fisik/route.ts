import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getReconcileSessionById, getNotInFisikMasters, getNotInFisikCount } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Masters with no matched physical-stock row for this session, scoped to the
// session's department. Supports subGroup + search filters (see getNotInFisikMasters).
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reconcileSession = await getReconcileSessionById(params.sessionId);
    if (!reconcileSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const sp = new URL(req.url).searchParams;

    // Lightweight count for the summary card (see feedback: don't fetch the full
    // list just to read .length).
    if (sp.get('countOnly') === '1' || sp.get('countOnly') === 'true') {
      const count = await getNotInFisikCount(params.sessionId, reconcileSession.department);
      return NextResponse.json({ count });
    }

    const masters = await getNotInFisikMasters(params.sessionId, reconcileSession.department, {
      subGroup: sp.get('subGroup') || undefined,
      search: sp.get('search') || undefined,
    });

    return NextResponse.json({ session: reconcileSession, masters });
  } catch (err) {
    console.error('[GET /api/admin/kb/reconcile/[sessionId]/not-in-fisik]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
