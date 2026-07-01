import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { markNotificationsRead } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { requestId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL' && session.user.role !== 'CASHIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requestId = params.requestId?.trim();
    if (!requestId) return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });

    await markNotificationsRead(session.user.id, [requestId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/admin/notifications/read/:requestId]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
