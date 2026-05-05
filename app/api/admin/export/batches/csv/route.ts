import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { generateBatchCSV } from '@/lib/export';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : null;
    const type = searchParams.get('type');

    const where: any = {};
    if (type && type !== 'ALL') where.requestType = type;
    if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else {
      const group = searchParams.get('outletGroup');
      const status = searchParams.get('status');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (group && group !== 'ALL') where.outletGroup = group;
      if (status && status !== 'ALL') where.status = status;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.createdAt.lte = d; }
      }
    }

    const batches = await prisma.requestBatch.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const items = batches.flatMap((b) => b.items.map((item) => ({
      batchTitle: b.title,
      code: item.code,
      name: item.name,
      category: item.category,
      department: item.department,
      price: item.price,
      folder: item.folder,
      serviceCharge: item.serviceCharge,
      tax1: item.tax1,
      tax2: item.tax2,
      noDiscount: item.noDiscount,
      hideReceipt: item.hideReceipt,
      printers: item.printers,
      outlets: item.outlets,
      salesDef: item.salesDef,
    })));

    if (items.length === 0) {
      return NextResponse.json({ error: 'No batch items found' }, { status: 404 });
    }

    const csv = generateBatchCSV(items);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
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
