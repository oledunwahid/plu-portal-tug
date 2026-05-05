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
    const group = searchParams.get('group');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const baseWhere: any = {};
    if (group && group !== 'ALL') baseWhere.outletGroup = group;
    if (from || to) {
      baseWhere.createdAt = {};
      if (from) baseWhere.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        baseWhere.createdAt.lte = toDate;
      }
    }

    const [newItems, updatePrice, updateName, updatePrinter, totalDone] = await Promise.all([
      prisma.pLURequest.count({ where: { ...baseWhere, requestType: 'NEW_ITEM' } }),
      prisma.pLURequest.count({ where: { ...baseWhere, requestType: 'UPDATE_PRICE' } }),
      prisma.pLURequest.count({ where: { ...baseWhere, requestType: 'UPDATE_NAME' } }),
      prisma.pLURequest.count({ where: { ...baseWhere, requestType: 'UPDATE_PRINTER' } }),
      prisma.pLURequest.count({ where: { ...baseWhere, status: 'DONE' } }),
    ]);

    return NextResponse.json(
      { newItems, updatePrice, updateName, updatePrinter, totalDone },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
    );
  } catch (error) {
    console.error('[GET /api/admin/metrics]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
