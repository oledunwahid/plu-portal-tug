import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { markRequestsExported } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const type = body.type === 'batch' ? 'batch' : 'single';
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (ids.length === 0) return NextResponse.json({ error: 'ids array is required' }, { status: 400 });

    const updated = await markRequestsExported(ids, type, session.user.name);
    return NextResponse.json({ updated });
  } catch (error) {
    console.error('[POST /api/admin/export/mark-exported]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
