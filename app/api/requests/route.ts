import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { createRequestSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const pluRequest = await prisma.pLURequest.create({
      data: {
        requestType: data.requestType,
        code: data.code ?? null,
        name: data.name,
        category: data.category,
        department: data.department,
        price: data.price ?? null,
        folder: data.folder ?? null,
        serviceCharge: data.serviceCharge,
        tax1: data.tax1,
        tax2: data.tax2,
        noDiscount: data.noDiscount,
        hideReceipt: data.hideReceipt,
        printers: data.printers,
        outlets: data.outlets,
        remarks: data.remarks ?? null,
        userId: session.user.id,
        outletGroup: session.user.outletGroup,
        cashierOutlet: session.user.outlet,
      },
    });

    return NextResponse.json(pluRequest, { status: 201 });
  } catch (error) {
    console.error('[POST /api/requests]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requests = await prisma.pLURequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('[GET /api/requests]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
