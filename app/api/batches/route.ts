import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches, createRequestBatch } from '@/lib/db';
import { OUTLET_TO_GROUP } from '@/lib/outlets';
import type { BatchItemInput } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const batches = await getRequestBatches({ userId: session.user.id, limit: 200 });
    return NextResponse.json(batches);
  } catch (error) {
    console.error('[GET /api/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Batch title is required' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const validTypes = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'UPDATE_FULL'];
    const requestType = validTypes.includes(body.requestType) ? body.requestType : 'NEW_ITEM';
    const outletGroup = OUTLET_TO_GROUP[session.user.outlet] ?? 'UNION';

    const items: BatchItemInput[] = (body.items as unknown[]).map((item: unknown) => {
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
    });

    const batch = await createRequestBatch(
      { title: body.title.trim(), requestType, outletGroup, cashierOutlet: session.user.outlet, userId: session.user.id },
      items
    );

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error('[POST /api/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
