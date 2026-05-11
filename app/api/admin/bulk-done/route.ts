import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { bulkMarkPLURequestsDone } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const ids: unknown = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Cannot mark more than 200 requests at once' }, { status: 400 });
    }

    const validIds = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    const updated = await bulkMarkPLURequestsDone(validIds);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error('[POST /api/admin/bulk-done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
