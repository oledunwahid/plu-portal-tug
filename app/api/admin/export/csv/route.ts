import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { generateDoneCSV } from '@/lib/export';
import { v4 as uuidv4 } from 'uuid';

const UPDATE_TYPES = ['UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'UPDATE_FULL'];

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
    const preview = searchParams.get('preview') === 'true';

    const where: any = {};
    if (type && type !== 'ALL') where.requestType = type;

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else {
      const group = searchParams.get('group') ?? searchParams.get('outletGroup');
      const status = searchParams.get('status');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (!group) return NextResponse.json({ error: 'group is required' }, { status: 400 });
      if (group !== 'ALL') where.outletGroup = group;
      if (status && status !== 'ALL') where.status = status;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = toDate;
        }
      }
    }

    const requests = await prisma.pLURequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (preview) {
      return NextResponse.json({ count: requests.length, items: requests });
    }

    if (requests.length === 0) {
      return NextResponse.json({ error: 'No requests found for this filter' }, { status: 404 });
    }

    const csv = generateDoneCSV(requests as any);
    const now = new Date();

    // Mark with exportedAt only for update-type requests (not NEW_ITEM)
    const updateIds = requests.filter((r) => UPDATE_TYPES.includes(r.requestType)).map((r) => r.id);
    if (updateIds.length > 0) {
      const batchId = uuidv4();
      await prisma.pLURequest.updateMany({
        where: { id: { in: updateIds } },
        data: { exportedAt: now, exportBatchId: batchId },
      });
    }

    const dateStr = now.toISOString().slice(0, 10);
    const typeSlug = type ? type.toLowerCase().replace(/_/g, '-') : 'mixed';
    const group = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';
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
