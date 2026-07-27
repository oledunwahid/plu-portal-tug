import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequests, countPLURequests, getMasterMapByCodes } from '@/lib/db';

// Update types whose rows don't store the existing item's name/category - enriched from the registry.
const ENRICH_TYPES = new Set(['UPDATE_PRICE', 'UPDATE_NAME']);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const userId      = searchParams.get('userId') ?? undefined;
    const search      = searchParams.get('search')?.trim() || undefined;
    const countOnly   = searchParams.get('countOnly') === '1';

    const filters = { status, outletGroup, requestType, from, to, userId, search };

    if (countOnly) {
      const count = await countPLURequests(filters);
      return NextResponse.json({ count });
    }

    const requests = await getPLURequests({ ...filters, limit: 500 });

    // Enrich UPDATE_PRICE / UPDATE_NAME rows with the registry name & category for display/export.
    const masterMap = await getMasterMapByCodes(
      requests.filter((r) => ENRICH_TYPES.has(r.requestType)).map((r) => r.code),
    );
    const enriched = requests.map((r) => {
      const m = ENRICH_TYPES.has(r.requestType) && r.code ? masterMap.get(r.code) : undefined;
      return { ...r, masterName: m?.name ?? '', masterCategory: m?.category ?? '' };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[GET /api/admin/requests]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
