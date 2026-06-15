import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches, getMasterMapByCodes } from '@/lib/db';
import { generateTemplateCSV, requestToTemplateRow, isMasterSourced, buildMissingMasterWarning } from '@/lib/export';

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
    const type     = searchParams.get('type') ?? undefined;
    const previewVal = searchParams.get('preview');
    const preview  = previewVal === '1' || previewVal === 'true';

    const filters: Parameters<typeof getRequestBatches>[0] = { orderAsc: true, limit: 2000 };
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
    const typeSlug = type ? type.toLowerCase().replace(/_/g, '-') : 'mixed';
    const filename = `batch-${typeSlug}-${dateStr}.csv`;

    // Flatten every batch item, tagging it with its batch's request type so the dispatcher can source
    // each row correctly (NEW_ITEM from the request; UPDATE_* / REMOVE_PLU from master by PLU code).
    // The preview id (`batchId:itemId`) matches the export page's flattened row id for selection.
    const items = batches.flatMap((b) => b.items.map((item) => ({
      ...item, requestType: b.requestType, previewId: `${b.id}:${item.id}`,
    })));

    const masterMap = await getMasterMapByCodes(items.map((i) => i.code));
    const previewRows = items.map((item) => ({
      id: item.previewId,
      ...requestToTemplateRow(item.requestType, item, item.code ? masterMap.get(item.code) : undefined),
    }));

    // Side-effect-free preview for the export page's "Export preview" toggle.
    if (preview) return NextResponse.json({ count: previewRows.length, rows: previewRows });
    if (items.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });

    // The generators only read TEMPLATE_HEADERS columns, so the extra `id` on each row is ignored.
    const csv = generateTemplateCSV(previewRows);

    const masterRows = items.filter((i) => isMasterSourced(i.requestType));
    const warningHeader = buildMissingMasterWarning(
      masterRows.map((i) => ({ code: i.code, name: i.name })), masterMap, '[GET /api/admin/export/batches/csv]',
    );

    const headers: Record<string, string> = {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    };
    if (warningHeader) {
      headers['X-Export-Warnings'] = warningHeader;
      headers['Access-Control-Expose-Headers'] = 'X-Export-Warnings';
    }
    return new NextResponse(csv, { status: 200, headers });
  } catch (error) {
    console.error('[GET /api/admin/export/batches/csv]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
