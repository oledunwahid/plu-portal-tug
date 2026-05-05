import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const batch = await prisma.requestBatch.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && batch.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      doneAt: batch.doneAt?.toISOString() ?? null,
      exportedAt: batch.exportedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[GET /api/batches/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const batch = await prisma.requestBatch.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && batch.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (batch.status === 'DONE') {
      return NextResponse.json({ error: 'Cannot edit a completed batch' }, { status: 409 });
    }

    const body = await req.json();

    // Delete existing items and recreate
    await prisma.requestBatchItem.deleteMany({ where: { batchId: params.id } });

    const updated = await prisma.requestBatch.update({
      where: { id: params.id },
      data: {
        title: body.title?.trim() ?? batch.title,
        requestType: body.requestType ?? batch.requestType,
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
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      doneAt: updated.doneAt?.toISOString() ?? null,
      exportedAt: updated.exportedAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[PATCH /api/batches/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
