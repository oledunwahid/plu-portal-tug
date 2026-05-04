import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

    const where: Prisma.PLURequestWhereInput = {};

    if (status && status !== 'ALL') where.status = status as any;
    if (outletGroup && outletGroup !== 'ALL') where.outletGroup = outletGroup;
    if (requestType && requestType !== 'ALL') where.requestType = requestType as any;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as any).lte = toDate;
      }
    }

    const requests = await prisma.pLURequest.findMany({
      where,
      include: { submittedBy: { select: { id: true, name: true, email: true, outlet: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('[GET /api/admin/requests]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
