import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { getWineImportBatch } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const batch = await getWineImportBatch(params.batchId);
    if (!batch) return NextResponse.json({ error: 'Import batch tidak ditemukan.' }, { status: 404 });
    return NextResponse.json({ batch });
  } catch (err) {
    return wineServerError(`GET /api/wines/import/${params.batchId}`, err);
  }
}
