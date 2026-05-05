import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { OUTLET_TO_GROUP } from '@/lib/outlets';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const batches = await prisma.requestBatch.findMany({
      where: { userId: session.user.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json(batches.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      doneAt: b.doneAt?.toISOString() ?? null,
      exportedAt: b.exportedAt?.toISOString() ?? null,
    })));
  } catch (error) {
    console.error('[GET /api/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Batch title is required' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const validTypes = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'UPDATE_FULL'];
    const requestType = validTypes.includes(body.requestType) ? body.requestType : 'NEW_ITEM';

    const outletGroup = OUTLET_TO_GROUP[session.user.outlet] ?? 'UNION';

    const batch = await prisma.requestBatch.create({
      data: {
        title: body.title.trim(),
        requestType,
        outletGroup,
        cashierOutlet: session.user.outlet,
        userId: session.user.id,
        items: {
          create: (body.items as any[]).map((item: any, index: number) => ({
            code: item.code ?? null,
            name: item.name,
            category: item.category,
            department: item.department,
            price: item.price ?? null,
            folder: item.folder ?? null,
            serviceCharge: item.serviceCharge ?? true,
            tax1: item.tax1 ?? true,
            tax2: item.tax2 ?? true,
            noDiscount: item.noDiscount ?? true,
            hideReceipt: item.hideReceipt ?? false,
            printers: Array.isArray(item.printers) ? item.printers.join(';') : (item.printers ?? ''),
            outlets: Array.isArray(item.outlets) ? item.outlets.join(';') : (item.outlets ?? ''),
            sortOrder: index,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      doneAt: null,
      exportedAt: null,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
