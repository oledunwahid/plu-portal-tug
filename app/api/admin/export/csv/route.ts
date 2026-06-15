import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestsRaw, getMasterMapByCodes, markPLURequestsExported } from '@/lib/db';
import { generateTemplateCSV, requestToTemplateRow, isMasterSourced, buildMissingMasterWarning } from '@/lib/export';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPDATE_TYPES = ['UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'UPDATE_FULL'];

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

    const filters: Parameters<typeof getPLURequestsRaw>[0] = { orderAsc: true, limit: 2000 };
    if (type && type !== 'ALL') filters.requestType = type;

    if (ids && ids.length > 0) {
      filters.ids = ids;
    } else {
      const group  = searchParams.get('group') ?? searchParams.get('outletGroup') ?? undefined;
      const status = searchParams.get('status') ?? undefined;
      const from   = searchParams.get('from') ?? undefined;
      const to     = searchParams.get('to') ?? undefined;
      if (!group) return NextResponse.json({ error: 'group is required' }, { status: 400 });
      if (group !== 'ALL') filters.outletGroup = group;
      if (status && status !== 'ALL') filters.status = status;
      if (from) filters.from = from;
      if (to)   filters.to   = to;
    }

    const now     = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const group   = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';

    const requests = await getPLURequestsRaw(filters);

    // Every type emits the unified 18-col structure. The row type drives sourcing: NEW_ITEM uses the
    // request as-is; UPDATE_* / REMOVE_PLU pull from master (looked up by PLU code) and override one
    // column. For a mixed export (no single type filter), each row resolves by its own requestType.
    const rowType = (r: { requestType: string }) => (type && type !== 'ALL' ? type : r.requestType);
    const masterMap = await getMasterMapByCodes(requests.map((r) => r.code));
    const previewRows = requests.map((r) => ({
      id: r.id,
      ...requestToTemplateRow(rowType(r), r, r.code ? masterMap.get(r.code) : undefined),
    }));

    // Side-effect-free preview (used by the export page's "Export preview" toggle): the exact rows
    // that will be written to the file, keyed by request id, with no mark-exported transition.
    if (preview) return NextResponse.json({ count: previewRows.length, rows: previewRows });
    if (requests.length === 0) return NextResponse.json({ error: 'No requests found for this filter' }, { status: 404 });

    // The generators only read TEMPLATE_HEADERS columns, so the extra `id` on each row is ignored.
    const csv = generateTemplateCSV(previewRows);

    // Only master-sourced rows (UPDATE_* / REMOVE_PLU) can be "missing master"; NEW_ITEM never is.
    const masterRows = requests.filter((r) => isMasterSourced(rowType(r)));
    const warningHeader = buildMissingMasterWarning(masterRows, masterMap, '[GET /api/admin/export/csv]');

    // UPDATE_* rows advance to EXPORTED on download. NEW_ITEM and REMOVE_PLU exported-state is driven
    // by the client via the mark-exported endpoint, so they are left untouched here.
    const updateIds = requests.filter((r) => UPDATE_TYPES.includes(r.requestType)).map((r) => r.id);
    if (updateIds.length > 0) {
      await markPLURequestsExported(updateIds, now.toISOString(), uuidv4());
    }

    const typeSlug = type ? type.toLowerCase().replace(/_/g, '-') : 'mixed';
    const filename = `plu-${typeSlug}-${group.toLowerCase()}-${dateStr}.csv`;
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
    console.error('[GET /api/admin/export/csv]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
