import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestsRaw, getPLURequests, getMasterMapByCodes, markPLURequestsExported } from '@/lib/db';
import { generateDoneCSV, generateUpdateNameCSV, generateTemplateCSV, priceToTemplateRow, newItemToTemplateRow, buildMissingMasterWarning, type TemplateRow, type UpdateExportRow } from '@/lib/export';
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
    const preview  = searchParams.get('preview') === 'true';

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

    const now = new Date();

    const dateStr = now.toISOString().slice(0, 10);
    const group   = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';

    // UPDATE_PRICE and NEW_ITEM both emit the 17-column import template (attributes from master).
    if (type === 'UPDATE_PRICE' || type === 'NEW_ITEM') {
      const requests = await getPLURequestsRaw(filters);
      if (preview) return NextResponse.json({ count: requests.length, items: requests });
      if (requests.length === 0) return NextResponse.json({ error: 'No requests found for this filter' }, { status: 404 });

      const masterMap = await getMasterMapByCodes(requests.map((r) => r.code));
      const rows: TemplateRow[] = requests.map((r) => {
        const m = r.code ? masterMap.get(r.code) : undefined;
        return type === 'UPDATE_PRICE' ? priceToTemplateRow(r.code, m, r.price) : newItemToTemplateRow(r, m);
      });
      const csv = generateTemplateCSV(rows);
      const warningHeader = buildMissingMasterWarning(requests, masterMap, '[GET /api/admin/export/csv]');

      // UPDATE_PRICE rows advance to EXPORTED on download (it is an UPDATE_TYPE); NEW_ITEM
      // exported-state is driven by the client via the mark-exported endpoint, so leave it here.
      if (type === 'UPDATE_PRICE') {
        await markPLURequestsExported(requests.map((r) => r.id), now.toISOString(), uuidv4());
      }

      const typeSlug = type.toLowerCase().replace(/_/g, '-');
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
    }

    // UPDATE_NAME stays a human-readable report (current vs new name, enriched from the registry).
    if (type === 'UPDATE_NAME') {
      const requests = await getPLURequests(filters);
      if (preview) return NextResponse.json({ count: requests.length, items: requests });
      if (requests.length === 0) return NextResponse.json({ error: 'No requests found for this filter' }, { status: 404 });

      const masterMap = await getMasterMapByCodes(requests.map((r) => r.code));
      const rows: UpdateExportRow[] = requests.map((r) => {
        const m = r.code ? masterMap.get(r.code) : undefined;
        return {
          code: r.code, masterName: m?.name ?? '', masterCategory: m?.category ?? '',
          masterDepartment: m?.department ?? '', masterBarcode: m?.barcode ?? '',
          newName: r.name, price: r.price, outlets: r.outlets, remarks: r.remarks,
          by: r.submittedBy?.name ?? '', createdAt: r.createdAt, status: r.status,
        };
      });
      const csv = generateUpdateNameCSV(rows);
      await markPLURequestsExported(requests.map((r) => r.id), now.toISOString(), uuidv4());
      const filename = `plu-update-name-${group.toLowerCase()}-${dateStr}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const requests = await getPLURequestsRaw(filters);

    if (preview) return NextResponse.json({ count: requests.length, items: requests });
    if (requests.length === 0) return NextResponse.json({ error: 'No requests found for this filter' }, { status: 404 });

    const csv = generateDoneCSV(requests);

    const updateIds = requests.filter((r) => UPDATE_TYPES.includes(r.requestType)).map((r) => r.id);
    if (updateIds.length > 0) {
      await markPLURequestsExported(updateIds, now.toISOString(), uuidv4());
    }

    const typeSlug = type ? type.toLowerCase().replace(/_/g, '-') : 'mixed';
    const filename = `plu-${typeSlug}-${group.toLowerCase()}-${dateStr}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/export/csv]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
