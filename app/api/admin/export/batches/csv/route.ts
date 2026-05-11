import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches } from '@/lib/db';
import { generateBatchCSV } from '@/lib/export';

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
    const items = batches.flatMap((b) => b.items.map((item) => ({
      batchTitle: b.title,
      code: item.code, name: item.name, category: item.category, department: item.department,
      price: item.price, folder: item.folder,
      serviceCharge: item.serviceCharge, tax1: item.tax1, tax2: item.tax2,
      noDiscount: item.noDiscount, hideReceipt: item.hideReceipt,
      printers: item.printers, outlets: item.outlets, salesDef: item.salesDef,
    })));

    if (items.length === 0) return NextResponse.json({ error: 'No batch items found' }, { status: 404 });

    const csv      = generateBatchCSV(items);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const typeSlug = type ? type.toLowerCase().replace(/_/g, '-') : 'mixed';
    const filename = `batch-${typeSlug}-${dateStr}.csv`;

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
