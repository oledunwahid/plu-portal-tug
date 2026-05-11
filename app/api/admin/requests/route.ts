import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequests, countPLURequests } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status      = searchParams.get('status') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const requestType = searchParams.get('requestType') ?? undefined;
    const from        = searchParams.get('from') ?? undefined;
    const to          = searchParams.get('to') ?? undefined;
    const userId      = searchParams.get('userId') ?? undefined;
    const countOnly   = searchParams.get('countOnly') === '1';

    const filters = { status, outletGroup, requestType, from, to, userId };

    if (countOnly) {
      const count = await countPLURequests(filters);
      return NextResponse.json({ count });
    }

    const requests = await getPLURequests({ ...filters, limit: 500 });
    return NextResponse.json(requests);
  } catch (error) {
    console.error('[GET /api/admin/requests]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
