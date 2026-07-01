import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequests } from '@/lib/db';
import { STATUS_PENDING_COST_CONTROL } from '@/lib/costControl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Live queue of requests awaiting cost-control review. Readable by cost control and admin (oversight).
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'COST_CONTROL' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requests = await getPLURequests({ status: STATUS_PENDING_COST_CONTROL, limit: 500 });
    return NextResponse.json(requests);
  } catch (error) {
    console.error('[GET /api/cost-control/queue]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
