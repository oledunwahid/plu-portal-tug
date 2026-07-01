import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAdminNotificationFeed, getRecentRequestIds, getReadRequestIds, type NotificationScope } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Unread count + "mark all as read" are bounded to the most recent SCAN_LIMIT requests,
// so a fresh admin (no read rows yet) doesn't surface — or have to mark — full history.
const SCAN_LIMIT = 500;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Served to ADMIN (full queue), COST_CONTROL (only PENDING_COST_CONTROL items), and CASHIER
    // (only their own DONE requests — "ready to sync").
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'COST_CONTROL' && role !== 'CASHIER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const scope: NotificationScope =
      role === 'COST_CONTROL' ? 'COST_CONTROL' : role === 'CASHIER' ? 'CASHIER' : 'ADMIN';
    // CASHIER scope filters strictly to the requester's own items; the other scopes are global.
    const feedUserId = role === 'CASHIER' ? session.user.id : undefined;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20) || 20, 1), 100);
    const offset = Math.max(Number(searchParams.get('offset') ?? 0) || 0, 0);

    const [feed, readSet, recentIds] = await Promise.all([
      getAdminNotificationFeed(limit, offset, scope, feedUserId),
      getReadRequestIds(session.user.id),
      getRecentRequestIds(SCAN_LIMIT, scope, feedUserId),
    ]);

    const notifications = feed.map((n) => ({ ...n, read: readSet.has(n.id) }));
    const unreadCount = recentIds.reduce((acc, id) => acc + (readSet.has(id) ? 0 : 1), 0);

    return NextResponse.json({ notifications, unreadCount, limit, offset });
  } catch (error) {
    console.error('[GET /api/admin/notifications]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
