import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestsRaw, getMasterMapByCodes } from '@/lib/db';
import { generateTemplateXLSX, requestToTemplateRow, isMasterSourced, buildMissingMasterWarning, type TemplateRow } from '@/lib/export';

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
      orderAsc: true, limit: 2000,
    };
    if (type && type !== 'ALL') filters.requestType = type;

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

    const group   = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';
    const dateStr = new Date().toISOString().slice(0, 10);

    const requests = await getPLURequestsRaw(filters);
    if (requests.length === 0) return NextResponse.json({ error: 'No requests found' }, { status: 404 });

    // Every type emits the unified 18-col structure (see lib/export). NEW_ITEM uses the request as-is;
    // UPDATE_* / REMOVE_PLU pull from master by PLU code and override one column.
    const rowType = (r: { requestType: string }) => (type && type !== 'ALL' ? type : r.requestType);
    const masterMap = await getMasterMapByCodes(requests.map((r) => r.code));
    const rows: TemplateRow[] = requests.map((r) =>
      requestToTemplateRow(rowType(r), r, r.code ? masterMap.get(r.code) : undefined),
    );
    const buffer = generateTemplateXLSX(rows);

    const masterRows = requests.filter((r) => isMasterSourced(rowType(r)));
    const warningHeader = buildMissingMasterWarning(masterRows, masterMap, '[GET /api/admin/export/xlsx]');

    const typeLabel = type === 'NEW_ITEM' ? 'new-items' : type.toLowerCase().replace(/_/g, '-');
    const filename = `${typeLabel}-${group.toLowerCase()}-${dateStr}.xlsx`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    };
    if (warningHeader) {
      headers['X-Export-Warnings'] = warningHeader;
      headers['Access-Control-Expose-Headers'] = 'X-Export-Warnings';
    }

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    console.error('[GET /api/admin/export/xlsx]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
