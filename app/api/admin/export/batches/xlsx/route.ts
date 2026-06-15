import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches, getMasterMapByCodes } from '@/lib/db';
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

    const filters: Parameters<typeof getRequestBatches>[0] = {
      orderAsc: true, limit: 2000,
    };
    if (type && type !== 'ALL') filters.requestType = type;

    if (ids && ids.length > 0) {
      filters.ids = ids;
    } else {
      const group  = searchParams.get('outletGroup') ?? undefined;
      const status = searchParams.get('status') ?? undefined;
      const from   = searchParams.get('from') ?? undefined;
      const to     = searchParams.get('to') ?? undefined;
      if (group && group !== 'ALL') filters.outletGroup = group;
      if (status && status !== 'ALL') filters.status = status;
      if (from) filters.from = from;
      if (to)   filters.to   = to;
    }

    const batches = await getRequestBatches(filters);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const typeLabel = type === 'NEW_ITEM' ? 'batch-new-items' : `batch-${type.toLowerCase().replace(/_/g, '-')}`;
    const filename = `${typeLabel}-${dateStr}.xlsx`;

    // Flatten every batch item, tagging it with its batch's request type so the dispatcher can source
    // each row correctly (NEW_ITEM from the request; UPDATE_* / REMOVE_PLU from master by PLU code).
    const items = batches.flatMap((b) => b.items.map((item) => ({ ...item, requestType: b.requestType })));
    if (items.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });

    const masterMap = await getMasterMapByCodes(items.map((i) => i.code));
    const rows: TemplateRow[] = items.map((item) =>
      requestToTemplateRow(item.requestType, item, item.code ? masterMap.get(item.code) : undefined),
    );
    const buffer = generateTemplateXLSX(rows);

    const masterRows = items.filter((i) => isMasterSourced(i.requestType));
    const warningHeader = buildMissingMasterWarning(
      masterRows.map((i) => ({ code: i.code, name: i.name })), masterMap, '[GET /api/admin/export/batches/xlsx]',
    );

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
    console.error('[GET /api/admin/export/batches/xlsx]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
