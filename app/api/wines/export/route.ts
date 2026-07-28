import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { parseWineListParams } from '@/lib/wineListParams';
import { getWineMasters } from '@/lib/wineDb';
import { generateWineListCsv } from '@/lib/wineExport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Hard ceiling so one export can't try to serialise an unbounded result set. */
const EXPORT_LIMIT = 20000;

/**
 * Export the Wine List as CSV.
 *
 * Uses the same query parsing as GET /api/wines, so the download always matches what the list on
 * screen was filtered to - only the pagination is dropped. Cost is included only for callers holding
 * WINE_LIST_VIEW_COST.
 */
export async function GET(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_EXPORT');
  if ('response' in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const { filters } = parseWineListParams(searchParams);
    const wines = await getWineMasters({ ...filters, limit: EXPORT_LIMIT, offset: 0 });
    const csv = generateWineListCsv(wines, guard.canViewCost);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="wine-list-${stamp}.csv"`,
      },
    });
  } catch (err) {
    return wineServerError('GET /api/wines/export', err);
  }
}
