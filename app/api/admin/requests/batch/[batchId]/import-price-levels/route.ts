import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRequestBatchById, getMasterMapByCodes, updateMasterItemsPriceLevels } from '@/lib/db';
import { rejectOversizedUpload, maxUploadMb } from '@/lib/upload';
import {
  validateSheetRows, buildPriceLevelUpdates, readSheetRecords, hasRequiredColumns,
} from '@/lib/priceLevelsSheet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Counterpart to export-price-levels. Two-phase by design: POST without ?confirm=true returns a
// before/after preview and writes nothing; ?confirm=true applies it. Only MasterItem.priceLevels
// is ever written - no item is created, and no other column is touched.

export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const batch = await getRequestBatchById(params.batchId);
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const nameLower = file.name.toLowerCase();
    if (!nameLower.endsWith('.csv') && !nameLower.endsWith('.xlsx') && !nameLower.endsWith('.xls')) {
      return NextResponse.json({ error: 'Please upload a .xlsx or .csv file.' }, { status: 400 });
    }
    const tooBig = rejectOversizedUpload(file, `File is too large. Maximum ${maxUploadMb()} MB.`);
    if (tooBig) return tooBig;

    const records = readSheetRecords(file.name, await file.arrayBuffer());
    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }

    if (!hasRequiredColumns(records)) {
      return NextResponse.json(
        { error: 'Missing required columns. Expected: ItemCode, SalesType, Outlets, Price.' },
        { status: 400 },
      );
    }

    // Scope: only codes that are both in this batch and present in master may be rewritten.
    const batchCodes = batch.items.map((i) => i.code).filter((c): c is string => !!c && c.trim() !== '');
    const masterMap = await getMasterMapByCodes(batchCodes);
    const allowedCodes = new Set(masterMap.keys());

    const { rows, errors } = validateSheetRows(records, allowedCodes);

    if (errors.length > 0) {
      return NextResponse.json({ valid: false, itemsToUpdate: [], errors }, { status: 422 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'The uploaded file has no data rows.' }, { status: 400 });
    }

    const updates = buildPriceLevelUpdates(rows);
    const itemsToUpdate = Array.from(updates.entries()).map(([itemCode, after]) => ({
      itemCode,
      before: masterMap.get(itemCode)?.priceLevels ?? '',
      after,
    }));

    const confirm = new URL(request.url).searchParams.get('confirm') === 'true';
    if (!confirm) {
      return NextResponse.json({ valid: true, itemsToUpdate, errors: [] });
    }

    // Skip items whose rebuilt string is byte-identical to what is stored - a no-op write would
    // still bump updatedAt and make the registry look changed when it was not.
    const changed = new Map<string, string>();
    for (const { itemCode, before, after } of itemsToUpdate) {
      if (before !== after) changed.set(itemCode, after);
    }

    const { updated, missing } = await updateMasterItemsPriceLevels(changed);
    if (missing.length > 0) {
      console.warn(
        `[POST /api/admin/requests/batch/${params.batchId}/import-price-levels] ${missing.length} code(s) vanished before write: ${missing.join(', ')}`,
      );
    }

    const unchanged = itemsToUpdate.length - changed.size;
    return NextResponse.json({
      success: true,
      updated,
      unchanged,
      message: unchanged > 0
        ? `Updated ${updated} item${updated === 1 ? '' : 's'}' price levels (${unchanged} unchanged).`
        : `Updated ${updated} item${updated === 1 ? '' : 's'}' price levels`,
    });
  } catch (error) {
    console.error(`[POST /api/admin/requests/batch/${params.batchId}/import-price-levels]`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
