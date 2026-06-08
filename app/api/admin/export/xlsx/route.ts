import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestsRaw, getPLURequests, getMasterMapByCodes } from '@/lib/db';
import { generateNewItemXLSX, generateDoneXLSX, generateUpdatePriceXLSX, generateUpdateNameXLSX, type UpdateExportRow } from '@/lib/export';

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
    const type     = searchParams.get('type') ?? 'NEW_ITEM';

    const filters: Parameters<typeof getPLURequestsRaw>[0] = {
      requestType: type, orderAsc: true, limit: 2000,
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

    const group    = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';
    const dateStr  = new Date().toISOString().slice(0, 10);

    let buffer: Buffer;
    if (type === 'UPDATE_PRICE' || type === 'UPDATE_NAME') {
      // Enriched human-readable report (name & category from the registry).
      const requests = await getPLURequests(filters);
      if (requests.length === 0) return NextResponse.json({ error: 'No requests found' }, { status: 404 });
      const masterMap = await getMasterMapByCodes(requests.map((r) => r.code));
      const rows: UpdateExportRow[] = requests.map((r) => {
        const m = r.code ? masterMap.get(r.code) : undefined;
        return {
          code: r.code, masterName: m?.name ?? '', masterCategory: m?.category ?? '',
          newName: r.name, price: r.price, outlets: r.outlets, remarks: r.remarks,
          by: r.submittedBy?.name ?? '', createdAt: r.createdAt, status: r.status,
        };
      });
      buffer = type === 'UPDATE_PRICE' ? generateUpdatePriceXLSX(rows) : generateUpdateNameXLSX(rows);
    } else {
      const requests = await getPLURequestsRaw(filters);
      if (requests.length === 0) return NextResponse.json({ error: 'No requests found' }, { status: 404 });
      buffer = type === 'NEW_ITEM' ? generateNewItemXLSX(requests) : generateDoneXLSX(requests);
    }

    const typeLabel = type === 'NEW_ITEM' ? 'new-items' : type.toLowerCase().replace(/_/g, '-');
    const filename = `${typeLabel}-${group.toLowerCase()}-${dateStr}.xlsx`;

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
