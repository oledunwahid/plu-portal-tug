import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatchById, getMasterMapByCodes } from '@/lib/db';
import { PRICE_LEVEL_SHEET_HEADERS, itemToSheetRows, type PriceLevelSheetRow } from '@/lib/priceLevelsSheet';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Long-form price-levels export for one request batch: the admin downloads this, edits the
// Price column in Excel, and re-imports it through import-price-levels. Deliberately separate
// from the 19-column item export - that one is the Quinos import file and must not change.
export async function GET(
  _request: NextRequest,
  { params }: { params: { batchId: string } },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const batch = await getRequestBatchById(params.batchId);
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const codes = batch.items.map((i) => i.code).filter((c): c is string => !!c && c.trim() !== '');
    const masterMap = await getMasterMapByCodes(codes);

    // A batch item whose PLU code has no master row cannot contribute price levels. Log it and
    // carry on - a single unmatched code must not deny the admin the rest of the sheet.
    const unmatched = codes.filter((c) => !masterMap.has(c));
    if (unmatched.length > 0) {
      console.warn(
        `[GET /api/admin/requests/batch/${params.batchId}/export-price-levels] ${unmatched.length} code(s) not in master: ${unmatched.slice(0, 10).join(', ')}`,
      );
    }

    // Batch order, de-duplicated: the same code can appear on more than one item in a batch, and
    // its price levels must be emitted once.
    const rows: PriceLevelSheetRow[] = [];
    const seen = new Set<string>();
    for (const code of codes) {
      if (seen.has(code)) continue;
      seen.add(code);
      const master = masterMap.get(code);
      if (!master?.priceLevels || master.priceLevels.trim() === '') continue;
      rows.push(...itemToSheetRows(code, master.priceLevels));
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No price levels found in this batch' }, { status: 404 });
    }

    const aoa: (string | number)[][] = [
      [...PRICE_LEVEL_SHEET_HEADERS],
      ...rows.map((r) => [r.itemCode, r.salesType, r.outlets, r.price ?? '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PriceLevels');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `price-levels-batch-${params.batchId}-${timestamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`[GET /api/admin/requests/batch/${params.batchId}/export-price-levels]`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
