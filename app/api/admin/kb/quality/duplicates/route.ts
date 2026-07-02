import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAllMasterItemsForMatch, getAllSapItemsForMatch } from '@/lib/db';
import { buildAllGroups, applyFilters, type DupFilters, type DupGroup, type DupFilterOptions } from '@/lib/dupAnalysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The heavy pass (grouping + SAP fuzzy matching over both full registries) is
// memoised for a short window so rapid filter/search changes don't recompute it.
// Invalidated on a row-count change or after the TTL.
const CACHE_TTL_MS = 20_000;
let cache: { key: string; at: number; groups: DupGroup[]; filterOptions: DupFilterOptions } | null = null;

function parsePrice(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [masters, saps] = await Promise.all([getAllMasterItemsForMatch(), getAllSapItemsForMatch()]);

    const key = `${masters.length}:${saps.length}`;
    const now = Date.now();
    if (!cache || cache.key !== key || now - cache.at > CACHE_TTL_MS) {
      const built = buildAllGroups(masters, saps);
      cache = { key, at: now, groups: built.groups, filterOptions: built.filterOptions };
    }

    const sp = req.nextUrl.searchParams;
    const filters: DupFilters = {
      department: sp.get('department') ?? undefined,
      category: sp.get('category') ?? undefined,
      outlet: sp.get('outlet') ?? undefined,
      prefix: sp.get('prefix') ?? undefined,
      search: sp.get('search') ?? undefined,
      classification: sp.get('classification') ?? undefined,
      sort: sp.get('sort') ?? undefined,
      minPrice: parsePrice(sp.get('minPrice')),
      maxPrice: parsePrice(sp.get('maxPrice')),
    };

    const { groups, counts } = applyFilters(cache.groups, filters);
    return NextResponse.json({ groups, counts, filterOptions: cache.filterOptions });
  } catch (err) {
    console.error('[GET /api/admin/kb/quality/duplicates]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
