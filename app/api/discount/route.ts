import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDiscountRequests, createDiscountRequest } from '@/lib/db';
import { OUTLET_TO_GROUP } from '@/lib/outlets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const filters = {
      status,
      outletGroup,
      from,
      to,
      userId: session.user.role === 'CASHIER' ? session.user.id : undefined,
    };

    const records = await getDiscountRequests(filters);
    return NextResponse.json(records);
  } catch (error) {
    console.error('[GET /api/discount]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    if (!body.buttonName?.trim()) return NextResponse.json({ error: 'Button name is required' }, { status: 400 });
    if (!body.discountType) return NextResponse.json({ error: 'Discount type is required' }, { status: 400 });
    if (body.discountValue == null || Number(body.discountValue) <= 0) {
      return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 });
    }
    if (!body.applicableTo?.trim()) return NextResponse.json({ error: 'Applicable to is required' }, { status: 400 });
    if (!body.outlets || body.outlets.length === 0) return NextResponse.json({ error: 'At least one outlet is required' }, { status: 400 });

    const outletGroup = OUTLET_TO_GROUP[session.user.outlet] ?? 'UNION';
    const discountValueType = body.discountType === 'FIXED_AMOUNT' ? 'IDR' : 'PERCENT';

    const record = await createDiscountRequest({
      outletGroup,
      cashierOutlet: session.user.outlet,
      userId: session.user.id,
      buttonName: body.buttonName.trim(),
      discountType: body.discountType,
      discountValue: Number(body.discountValue),
      discountValueType,
      applicableTo: body.applicableTo.trim(),
      conditions: body.conditions || null,
      remarks: body.remarks || null,
      outlets: Array.isArray(body.outlets) ? body.outlets.join(';') : String(body.outlets),
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('[POST /api/discount]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
