import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { updateRequestSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pluRequest = await prisma.pLURequest.findUnique({
      where: { id: params.id },
      include: { submittedBy: { select: { id: true, name: true, email: true, outlet: true } } },
    });

    if (!pluRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(pluRequest);
  } catch (error) {
    console.error('[GET /api/admin/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const updated = await prisma.pLURequest.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        price: parsed.data.price ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/admin/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.pLURequest.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[DELETE /api/admin/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
