import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { createRequestSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const request = await prisma.pLURequest.findUnique({ where: { id: params.id } });
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.user.role === 'CASHIER' && request.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(request);
  } catch (error) {
    console.error('[GET /api/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const request = await prisma.pLURequest.findUnique({ where: { id: params.id } });
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.user.role === 'CASHIER' && request.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (request.status === 'DONE') {
      return NextResponse.json({ error: 'Cannot edit a completed request' }, { status: 409 });
    }

    const body = await req.json();
    const parsed = createRequestSchema.safeParse({ ...body, requestType: request.requestType });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }
    const updated = await prisma.pLURequest.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        department: parsed.data.department,
        price: parsed.data.price ?? null,
        folder: parsed.data.folder ?? null,
        printers: parsed.data.printers,
        outlets: parsed.data.outlets,
        serviceCharge: parsed.data.serviceCharge,
        tax1: parsed.data.tax1,
        tax2: parsed.data.tax2,
        noDiscount: parsed.data.noDiscount,
        hideReceipt: parsed.data.hideReceipt,
        remarks: parsed.data.remarks ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
