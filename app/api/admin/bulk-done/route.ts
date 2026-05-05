import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const ids: string[] = body.ids ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Cannot mark more than 200 requests at once' }, { status: 400 });
    }

    const result = await prisma.pLURequest.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'DONE', doneAt: new Date() },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('[POST /api/admin/bulk-done]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
