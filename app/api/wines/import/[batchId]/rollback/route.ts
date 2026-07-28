import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission } from '@/lib/wineApi';
import { rollbackWineImportBatch } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Roll an import batch back. Only wines created by the batch AND untouched since are removed; any row
 * a human has edited afterwards is kept and reported as `keptModified`, so a rollback can never
 * destroy curated work.
 */
export async function POST(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const guard = await requireWinePermission('WINE_LIST_IMPORT');
  if ('response' in guard) return guard.response;

  try {
    const result = await rollbackWineImportBatch(params.batchId, { performedBy: guard.user.id });
    if (!result.ok) {
      const notFound = result.error === 'Import batch tidak ditemukan.';
      return NextResponse.json({ error: result.error }, { status: notFound ? 404 : 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[POST /api/wines/import/${params.batchId}/rollback]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
