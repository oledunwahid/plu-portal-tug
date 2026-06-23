import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getReconcileSessions } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sessions = await getReconcileSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[GET /api/admin/kb/reconcile/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
