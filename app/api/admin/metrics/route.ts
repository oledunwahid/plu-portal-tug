import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLUMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group') ?? undefined;
    const from  = searchParams.get('from') ?? undefined;
    const to    = searchParams.get('to') ?? undefined;

    const metrics = await getPLUMetrics({ outletGroup: group, from, to });
    return NextResponse.json(metrics, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[GET /api/admin/metrics]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
