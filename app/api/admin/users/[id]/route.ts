import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { updateUserSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, name: true, role: true, outlet: true, active: true, createdAt: true },
    });

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('[GET /api/admin/users/:id]', error);
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
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const data: any = { ...parsed.data };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, role: true, outlet: true, active: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[PATCH /api/admin/users/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/users/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
