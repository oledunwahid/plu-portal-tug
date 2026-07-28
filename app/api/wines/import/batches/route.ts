import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { getWineImportBatches } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Recent import batches, for the history + rollback panel. Static segment, so it never shadows
 * /api/wines/import/[batchId].
 */
export async function GET(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 20) || 20, 1), 100);
    const batches = await getWineImportBatches(limit);
    return NextResponse.json({ batches });
  } catch (err) {
    return wineServerError('GET /api/wines/import/batches', err);
  }
}
