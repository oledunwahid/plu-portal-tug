import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRecentRequestIds, getReadRequestIds, markNotificationsRead, type NotificationScope } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Mirror the GET route's window so "mark all" clears exactly what the bell counts.
const SCAN_LIMIT = 500;

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'COST_CONTROL' && role !== 'CASHIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const scope: NotificationScope =
      role === 'COST_CONTROL' ? 'COST_CONTROL' : role === 'CASHIER' ? 'CASHIER' : 'ADMIN';
    const feedUserId = role === 'CASHIER' ? session.user.id : undefined;

    const [recentIds, readSet] = await Promise.all([
      getRecentRequestIds(SCAN_LIMIT, scope, feedUserId),
      getReadRequestIds(session.user.id),
    ]);
    const unreadIds = recentIds.filter((id) => !readSet.has(id));
    const marked = await markNotificationsRead(session.user.id, unreadIds);

    return NextResponse.json({ success: true, marked });
  } catch (error) {
    console.error('[POST /api/admin/notifications/read-all]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
