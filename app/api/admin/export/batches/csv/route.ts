import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches, getMasterMapByCodes } from '@/lib/db';
import { generateBatchCSV, generateUpdateNameCSV, generateTemplateCSV, priceToTemplateRow, newItemToTemplateRow, buildMissingMasterWarning, type TemplateRow, type UpdateExportRow } from '@/lib/export';

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

    // UPDATE_PRICE and NEW_ITEM both emit the 17-column import template (attributes from master).
    if (type === 'UPDATE_PRICE' || type === 'NEW_ITEM') {
      const masterMap = await getMasterMapByCodes(batches.flatMap((b) => b.items.map((i) => i.code)));
      const items = batches.flatMap((b) => b.items);
      if (items.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });
      const rows: TemplateRow[] = items.map((item) => {
        const m = item.code ? masterMap.get(item.code) : undefined;
        return type === 'UPDATE_PRICE' ? priceToTemplateRow(item.code, m, item.price) : newItemToTemplateRow(item, m);
      });
      const csv = generateTemplateCSV(rows);
      const warningHeader = buildMissingMasterWarning(
        items.map((i) => ({ code: i.code, name: i.name })), masterMap, '[GET /api/admin/export/batches/csv]',
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
    }

    // UPDATE_NAME stays a human-readable report (current vs new name, enriched from the registry).
    if (type === 'UPDATE_NAME') {
      const masterMap = await getMasterMapByCodes(batches.flatMap((b) => b.items.map((i) => i.code)));
      const rows: UpdateExportRow[] = batches.flatMap((b) => b.items.map((item) => {
        const m = item.code ? masterMap.get(item.code) : undefined;
        return {
          code: item.code, masterName: m?.name ?? '', masterCategory: m?.category ?? '',
          masterDepartment: m?.department ?? '', masterBarcode: m?.barcode ?? '',
          newName: item.name, price: item.price, outlets: item.outlets, remarks: item.remarks,
          by: b.submittedBy?.name ?? '', createdAt: b.createdAt, status: b.status,
        };
      }));
      if (rows.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });
      const csv = generateUpdateNameCSV(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const items = batches.flatMap((b) => b.items.map((item) => ({
      batchTitle: b.title,
      code: item.code, name: item.name, category: item.category, department: item.department,
      price: item.price, folder: item.folder,
      serviceCharge: item.serviceCharge, tax1: item.tax1, tax2: item.tax2,
      noDiscount: item.noDiscount, hideReceipt: item.hideReceipt,
      printers: item.printers, outlets: item.outlets, salesDef: item.salesDef,
      barcode: item.barcode,
    })));

    if (items.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });

    const csv      = generateBatchCSV(items);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/export/batches/csv]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
