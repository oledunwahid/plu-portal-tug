import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestByIdSimple, updatePLURequest } from '@/lib/db';
import { createRequestSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const request = await getPLURequestByIdSimple(params.id);
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

    const existing = await getPLURequestByIdSimple(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.status === 'DONE') {
      return NextResponse.json({ error: 'Cannot edit a completed request' }, { status: 409 });
    }

    const body = await req.json();
    const parsed = createRequestSchema.safeParse({ ...body, requestType: existing.requestType });
    if (!parsed.success) {
      // Log the exact failing field(s)/rule(s) so a future 400 can be diagnosed without guessing.
      console.error('[PATCH /api/requests/:id] validation failed:', JSON.stringify(parsed.error.issues));
      // First message per top-level field, keyed by field name so the client can render it inline.
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    const updated = await updatePLURequest(params.id, {
      name: parsed.data.name,
      category: parsed.data.category,
      department: parsed.data.department,
      price: parsed.data.price ?? null,
      folder: parsed.data.folder ?? null,
      printers: parsed.data.printers,
      outlets: parsed.data.outlets,
      barcode: parsed.data.department === 'WINE' ? (parsed.data.barcode ?? null) : null,
      serviceCharge: parsed.data.serviceCharge,
      tax1: parsed.data.tax1,
      tax2: parsed.data.tax2,
      noDiscount: parsed.data.noDiscount,
      hideReceipt: parsed.data.hideReceipt,
      remarks: parsed.data.remarks ?? null,
      updatedBy: session.user.name,
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/requests/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
