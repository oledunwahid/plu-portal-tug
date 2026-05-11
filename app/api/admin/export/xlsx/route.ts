import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestsRaw } from '@/lib/db';
import { generateNewItemXLSX } from '@/lib/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const ids      = idsParam ? idsParam.split(',').filter(Boolean) : null;

    const filters: Parameters<typeof getPLURequestsRaw>[0] = {
      requestType: 'NEW_ITEM', orderAsc: true, limit: 2000,
    };

    if (ids && ids.length > 0) {
      filters.ids = ids;
    } else {
      const group  = searchParams.get('group') ?? searchParams.get('outletGroup') ?? undefined;
      const status = searchParams.get('status') ?? undefined;
      const from   = searchParams.get('from') ?? undefined;
      const to     = searchParams.get('to') ?? undefined;
      if (group && group !== 'ALL') filters.outletGroup = group;
      if (status && status !== 'ALL') filters.status = status;
      if (from) filters.from = from;
      if (to)   filters.to   = to;
    }

    const requests = await getPLURequestsRaw(filters);
    if (requests.length === 0) return NextResponse.json({ error: 'No NEW_ITEM requests found' }, { status: 404 });

    const buffer   = generateNewItemXLSX(requests);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const group    = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';
    const filename = `new-items-${group.toLowerCase()}-${dateStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/export/xlsx]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
