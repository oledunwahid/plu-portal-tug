import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { generateNewItemXLSX } from '@/lib/export';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : null;

    const where: any = { requestType: 'NEW_ITEM' };

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else {
      const group = searchParams.get('group') ?? searchParams.get('outletGroup');
      const status = searchParams.get('status');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (group && group !== 'ALL') where.outletGroup = group;
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

    if (requests.length === 0) {
      return NextResponse.json({ error: 'No NEW_ITEM requests found' }, { status: 404 });
    }

    const buffer = generateNewItemXLSX(requests as any);
    const dateStr = new Date().toISOString().slice(0, 10);
    const group = searchParams.get('group') ?? searchParams.get('outletGroup') ?? 'all';
    const filename = `new-items-${group.toLowerCase()}-${dateStr}.xlsx`;

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
