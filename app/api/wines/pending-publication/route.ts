import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { getPendingPublicationRequests } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 25) || 25, 1), 100);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
    const { rows, total } = await getPendingPublicationRequests({
      search: searchParams.get('search') ?? undefined,
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({ rows, total, page, limit });
  } catch (err) {
    return wineServerError('GET /api/wines/pending-publication', err);
  }
}
