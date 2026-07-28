import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { getWineImportBatch, getWineImportErrors } from '@/lib/wineDb';
import { toCsv } from '@/lib/wineExport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Downloadable error report. `?format=csv` returns the file the PRD asks for (row number, wine name,
 * PLU code, barcode, error, recommendation); the default JSON form feeds the on-screen list.
 */
export async function GET(req: NextRequest, { params }: { params: { batchId: string } }) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const batch = await getWineImportBatch(params.batchId);
    if (!batch) return NextResponse.json({ error: 'Import batch tidak ditemukan.' }, { status: 404 });
    const errors = await getWineImportErrors(params.batchId);

    const { searchParams } = new URL(req.url);
    if (searchParams.get('format') === 'csv') {
      const csv = toCsv(
        ['Row Number', 'Wine Name', 'PLU Code', 'Barcode', 'Error', 'Recommendation'],
        errors.map((e) => [
          String(e.rowNumber), e.wineName ?? '', e.pluCode ?? '', e.barcode ?? '',
          e.error, e.recommendation ?? '',
        ]),
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wine-import-errors-${params.batchId.slice(0, 8)}.csv"`,
        },
      });
    }

    return NextResponse.json({ batch, errors });
  } catch (err) {
    return wineServerError(`GET /api/wines/import/${params.batchId}/errors`, err);
  }
}
