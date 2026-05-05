import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.requestBatch.findUnique({
      where: { id: params.id },
      include: { items: { select: { id: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'DONE') {
      return NextResponse.json({ error: 'Already marked as done' }, { status: 409 });
    }

    const updated = await prisma.requestBatch.update({
      where: { id: params.id },
      data: { status: 'DONE', doneAt: new Date() },
    });

    return NextResponse.json({
      ...updated,
      itemCount: existing.items.length,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      doneAt: updated.doneAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[POST /api/admin/batches/:id/done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
