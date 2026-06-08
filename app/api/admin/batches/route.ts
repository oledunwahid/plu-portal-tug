import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatches, getMasterMapByCodes } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Update types whose items don't store the existing item's name/category — enriched from the registry.
const ENRICH_TYPES = new Set(['UPDATE_PRICE', 'UPDATE_NAME']);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status      = searchParams.get('status') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const requestType = searchParams.get('requestType') ?? undefined;
    const from        = searchParams.get('from') ?? undefined;
    const to          = searchParams.get('to') ?? undefined;

    const batches = await getRequestBatches({ status, outletGroup, requestType, from, to, limit: 500 });

    // Enrich items of UPDATE_PRICE / UPDATE_NAME batches with the registry name & category.
    const masterMap = await getMasterMapByCodes(
      batches.filter((b) => ENRICH_TYPES.has(b.requestType)).flatMap((b) => b.items.map((i) => i.code)),
    );
    const enriched = batches.map((b) => {
      if (!ENRICH_TYPES.has(b.requestType)) return b;
      return {
        ...b,
        items: b.items.map((i) => {
          const m = i.code ? masterMap.get(i.code) : undefined;
          return { ...i, masterName: m?.name ?? '', masterCategory: m?.category ?? '' };
        }),
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[GET /api/admin/batches]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
