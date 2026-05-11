import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatchById, updateRequestBatch } from '@/lib/db';
import type { BatchItemInput } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const batch = await getRequestBatchById(params.id);
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && batch.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    console.error('[GET /api/batches/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await getRequestBatchById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'CASHIER' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.status === 'DONE') {
      return NextResponse.json({ error: 'Cannot edit a completed batch' }, { status: 409 });
    }

    const body = await req.json();

    const items: BatchItemInput[] = (Array.isArray(body.items) ? body.items : []).map(
      (item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          code: (i.code as string | null) ?? null,
          name: String(i.name ?? ''),
          category: String(i.category ?? ''),
          department: String(i.department ?? ''),
          price: i.price != null ? Number(i.price) : null,
          folder: (i.folder as string | null) ?? null,
          serviceCharge: i.serviceCharge !== false,
          tax1: i.tax1 !== false,
          tax2: i.tax2 !== false,
          noDiscount: i.noDiscount !== false,
          hideReceipt: i.hideReceipt === true,
          printers: Array.isArray(i.printers) ? (i.printers as string[]).join(';') : String(i.printers ?? ''),
          outlets: Array.isArray(i.outlets) ? (i.outlets as string[]).join(';') : String(i.outlets ?? ''),
          salesDef: (i.salesDef as string | undefined) ?? 'SALES',
        };
      }
    );

    const updated = await updateRequestBatch(
      params.id,
      { title: body.title?.trim(), requestType: body.requestType },
      items
    );
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PATCH /api/batches/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
