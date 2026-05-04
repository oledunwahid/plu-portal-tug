import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.pLURequest.update({
      where: { id: params.id },
      data: { status: 'DONE', doneAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[POST /api/admin/requests/:id/done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
