import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { createUserSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, outlet: true, active: true, createdAt: true },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[GET /api/admin/users]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const hash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        password: hash,
        name: parsed.data.name,
        role: parsed.data.role,
        outlet: parsed.data.outlet,
      },
      select: { id: true, email: true, name: true, role: true, outlet: true, active: true, createdAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/users]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
