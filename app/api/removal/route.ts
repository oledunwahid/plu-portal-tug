import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequests, countPLURequests } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const filters = {
      requestType: 'REMOVE_PLU',
      status: status && status !== 'ALL' ? status : undefined,
      outletGroup: outletGroup && outletGroup !== 'ALL' ? outletGroup : undefined,
      from,
      to,
      userId: session.user.role === 'CASHIER' ? session.user.id : undefined,
      limit: 500,
    };

    const requests = await getPLURequests(filters);
    const total = await countPLURequests({ ...filters, limit: undefined });
    return NextResponse.json({ requests, total });
  } catch (err) {
    console.error('[GET /api/removal]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
