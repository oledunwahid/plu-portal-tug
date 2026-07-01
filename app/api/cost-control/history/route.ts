import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCostControlHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Past reviewed requests (confirmed + rejected), filterable by date and outlet.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'COST_CONTROL' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requests = await getCostControlHistory({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      cashierOutlet: searchParams.get('outlet') ?? undefined,
    });
    return NextResponse.json(requests);
  } catch (error) {
    console.error('[GET /api/cost-control/history]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
