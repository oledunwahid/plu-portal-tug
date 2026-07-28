import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { searchMasterItemsForWine } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Step 1 of Add Wine: find the Master Item this wine already exists as. The Wine List never creates a
 * PLU, so this search is the only way in.
 *
 * Items already linked to an ACTIVE Wine Master are returned flagged (`linkedWineId`) rather than
 * hidden, so the user sees *why* an item isn't selectable instead of it silently missing. Pass
 * `excludeLinked=1` to drop them.
 */
export async function GET(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') ?? '').trim();
    const items = await searchMasterItemsForWine({
      query,
      outlet: searchParams.get('outlet') ?? undefined,
      department: searchParams.get('department') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      includeLinked: searchParams.get('excludeLinked') !== '1',
      limit: Number(searchParams.get('limit') ?? 25),
    });
    return NextResponse.json({ items });
  } catch (err) {
    return wineServerError('GET /api/wines/master-items/search', err);
  }
}
