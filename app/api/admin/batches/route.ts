import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const outletGroup = searchParams.get('outletGroup');
    const requestType = searchParams.get('requestType');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (outletGroup && outletGroup !== 'ALL') where.outletGroup = outletGroup;
    if (requestType && requestType !== 'ALL') where.requestType = requestType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const batches = await prisma.requestBatch.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, name: true, email: true, outlet: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json(batches.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      doneAt: b.doneAt?.toISOString() ?? null,
      exportedAt: b.exportedAt?.toISOString() ?? null,
    })));
  } catch (error) {
    console.error('[GET /api/admin/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
