import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDiscountRequestById, updateDiscountRequest, deleteDiscountRequest } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const record = await getDiscountRequestById(params.id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.user.role === 'CASHIER' && record.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('[GET /api/discount/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await getDiscountRequestById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.user.role === 'CASHIER' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.user.role === 'CASHIER' && existing.status === 'DONE') {
      return NextResponse.json({ error: 'Cannot edit a completed request' }, { status: 409 });
    }

    const body = await req.json();

    if (session.user.role === 'ADMIN') {
      const updates: Parameters<typeof updateDiscountRequest>[1] = { updatedBy: session.user.name };
      if (body.adminNote !== undefined) updates.adminNote = body.adminNote || null;
      if (body.status === 'DONE') {
        updates.status = 'DONE';
        updates.doneAt = new Date().toISOString();
      }
      const updated = await updateDiscountRequest(params.id, updates);
      return NextResponse.json(updated);
    }

    const updated = await updateDiscountRequest(params.id, {
      buttonName: body.buttonName?.trim() || existing.buttonName,
      discountType: body.discountType || existing.discountType,
      discountValue: body.discountValue != null ? Number(body.discountValue) : existing.discountValue,
      discountValueType: body.discountType === 'FIXED_AMOUNT' ? 'IDR' : body.discountType === 'PERCENTAGE' ? 'PERCENT' : existing.discountValueType,
      outlets: body.outlets ? (Array.isArray(body.outlets) ? body.outlets.join(';') : String(body.outlets)) : existing.outlets,
      applicableTo: body.applicableTo?.trim() || existing.applicableTo,
      conditions: body.conditions ?? existing.conditions,
      remarks: body.remarks ?? existing.remarks,
      updatedBy: session.user.name,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/discount/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const deleted = await deleteDiscountRequest(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/discount/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
