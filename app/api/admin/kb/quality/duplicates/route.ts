import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getLightGroupsCached, getSapIndexCached } from '@/lib/dupCache';
import {
  applyFilters, computeGroupEvidence,
  type DupFilters, type DupGroup,
} from '@/lib/dupAnalysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
// Above this filtered-result size we never enrich inline with SAP evidence on a
// search — the client lazy-loads it per group on expand instead.
const INLINE_SAP_MAX = 100;

function parsePrice(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseIntParam(v: string | null, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Light groups only — grouping + cheap classification, no SAP scoring.
    const { groups: allGroups, filterOptions } = await getLightGroupsCached();

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

    const { groups: filtered, counts } = applyFilters(allGroups, filters);

    const limit = Math.min(MAX_LIMIT, parseIntParam(sp.get('limit'), DEFAULT_LIMIT));
    const totalGroups = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalGroups / limit));
    const page = Math.min(Math.max(1, parseIntParam(sp.get('page'), 1)), totalPages);
    let pageGroups: DupGroup[] = filtered.slice((page - 1) * limit, page * limit);

    // Optional inline SAP evidence: only when the admin has run a search AND the
    // filtered result set is small enough to fit on one page. Keeps "search 1800
    // anejo" showing SAP classification without waiting for a manual expand,
    // while staying bounded (≤ one page against a capped, cached index). SAP
    // eligibility is by candidate presence — groups with no matching SAP row
    // resolve near-instantly via the token prefilter.
    const hasSearch = !!filters.search?.trim();
    if (hasSearch && totalGroups <= INLINE_SAP_MAX && pageGroups.length > 0) {
      const sapIndex = await getSapIndexCached();
      pageGroups = pageGroups.map((g) => ({ ...g, ...computeGroupEvidence(g.masterItems, g.base, sapIndex) }));
    }

    return NextResponse.json({
      groups: pageGroups,
      page,
      limit,
      totalGroups,
      totalPages,
      counts,
      filterOptions,
    });
  } catch (err) {
    console.error('[GET /api/admin/kb/quality/duplicates]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
