import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission } from '@/lib/wineApi';
import { parseWineImportFile } from '@/lib/wineImportFile';
import {
  suggestColumnMapping,
  parseWineImportRow,
  planWineImport,
  summarizeWineImport,
  importErrorRows,
  WINE_IMPORT_FIELDS,
  type WineColumnMapping,
  type WineImportPlanRow,
} from '@/lib/wineImport';
import { wineMasterDataKey } from '@/lib/wineDb';
import {
  buildWineImportLookup,
  ensureWineMasterDataIds,
  createWineImportBatch,
  executeWineImportRows,
  completeWineImportBatch,
  type WineImportExecuteRow,
} from '@/lib/wineDb';
import type { WineMasterDataType } from '@/lib/wine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readMapping(raw: string | null, headers: string[]): WineColumnMapping | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapping: WineColumnMapping = {};
    for (const field of WINE_IMPORT_FIELDS) {
      const column = parsed[field];
      if (typeof column === 'string' && headers.includes(column)) mapping[field] = column;
    }
    return mapping;
  } catch {
    return null;
  }
}

/** Every free-text reference name in the file, so all of them can be resolved in one write pass. */
function collectReferenceNames(plan: WineImportPlanRow[]): { type: WineMasterDataType; name: string }[] {
  const entries: { type: WineMasterDataType; name: string }[] = [];
  const push = (type: WineMasterDataType, name: string | null) => {
    if (name && name.trim()) entries.push({ type, name: name.trim() });
  };
  for (const row of plan) {
    if (row.outcome !== 'CREATE' && row.outcome !== 'UPDATE') continue;
    push('PRODUCER', row.producer);
    push('COUNTRY', row.country);
    push('REGION', row.region);
    push('APPELLATION', row.appellation);
    push('CLASSIFICATION', row.classification);
    push('WINE_TYPE', row.wineType);
    push('CATEGORY', row.category);
    push('SUB_CATEGORY', row.subCategory1);
    push('SUB_CATEGORY', row.subCategory2);
    push('BOTTLE_SIZE', row.bottleSize);
    for (const varietal of row.varietals) push('VARIETAL', varietal);
  }
  return entries;
}

/**
 * Executes an approved import.
 *
 * The file is re-parsed and re-planned server-side rather than trusting a plan posted by the client:
 * the registry may have changed since preview, and the plan decides what gets written.
 *
 * The import never creates a Master Item. Rows that match nothing are recorded as UNMATCHED in the
 * batch's error report for later manual mapping.
 */
export async function POST(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_IMPORT');
  if ('response' in guard) return guard.response;

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File belum dipilih.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheetParam = form.get('sheet');
    const parsed = parseWineImportFile(buffer, typeof sheetParam === 'string' ? sheetParam : undefined);
    const mappingParam = form.get('mapping');
    const mapping =
      readMapping(typeof mappingParam === 'string' ? mappingParam : null, parsed.headers)
      ?? suggestColumnMapping(parsed.headers);
    if (!mapping.wineName) {
      return NextResponse.json({ error: 'Kolom Wine Name belum dipetakan.' }, { status: 400 });
    }

    const rows = parsed.rows.map((row) => parseWineImportRow(row, mapping));
    const lookup = await buildWineImportLookup();
    const plan = planWineImport(rows, lookup);

    const batchId = await createWineImportBatch({
      fileName: file.name,
      totalRows: plan.length,
      uploadedBy: guard.user.id,
    });

    // Resolve every producer / country / varietal / … name to a master-data id, creating what is
    // missing. Normalized-name dedupe means repeated spellings converge on one record.
    const refIds = await ensureWineMasterDataIds(collectReferenceNames(plan), guard.user.id);
    const resolve = (type: WineMasterDataType, name: string | null): string | null =>
      (name && name.trim() ? refIds.get(wineMasterDataKey(type, name)) ?? null : null);

    const executable: WineImportExecuteRow[] = plan
      .filter((row) => (row.outcome === 'CREATE' || row.outcome === 'UPDATE') && row.masterItemId)
      .map((row) => ({
        rowNumber: row.rowNumber,
        masterItemId: row.masterItemId as string,
        masterItemCode: row.masterItemCode,
        masterItemName: row.masterItemName,
        existingWineId: row.existingWineId,
        legacyWineCode: row.legacyCode,
        wineName: row.wineName,
        producerId: resolve('PRODUCER', row.producer),
        countryId: resolve('COUNTRY', row.country),
        regionId: resolve('REGION', row.region),
        appellationId: resolve('APPELLATION', row.appellation),
        classificationId: resolve('CLASSIFICATION', row.classification),
        wineTypeId: resolve('WINE_TYPE', row.wineType),
        categoryId: resolve('CATEGORY', row.category),
        subCategory1Id: resolve('SUB_CATEGORY', row.subCategory1),
        subCategory2Id: resolve('SUB_CATEGORY', row.subCategory2),
        bottleSizeId: resolve('BOTTLE_SIZE', row.bottleSize),
        vintage: row.vintage,
        isNonVintage: row.isNonVintage,
        abv: row.abv,
        // Cost is only stored when the importer is allowed to see cost at all.
        costPerBottle: guard.canViewCost ? row.costPerBottle : null,
        status: row.status,
        varietalIds: row.varietals
          .map((name) => resolve('VARIETAL', name))
          .filter((id): id is string => Boolean(id)),
      }));

    const result = await executeWineImportRows(batchId, executable, { performedBy: guard.user.id });

    const summary = summarizeWineImport(plan);
    // Rows that failed during the write move from matched to failed in the final tally.
    const finalSummary = {
      createdRows: result.created,
      updatedRows: result.updated,
      duplicateRows: summary.duplicateRows,
      failedRows: summary.failedRows + result.failed.length,
      skippedRows: summary.skippedRows + result.failed.length,
      matchedRows: result.created + result.updated,
      unmatchedRows: summary.unmatchedRows,
    };

    const errors = [
      ...importErrorRows(plan),
      ...result.failed.map((f) => ({
        rowNumber: f.rowNumber,
        wineName: plan.find((p) => p.rowNumber === f.rowNumber)?.wineName ?? null,
        pluCode: plan.find((p) => p.rowNumber === f.rowNumber)?.masterItemCode ?? null,
        barcode: plan.find((p) => p.rowNumber === f.rowNumber)?.barcode ?? null,
        error: f.error,
        recommendation: 'Periksa wine yang sudah ada untuk Master Item ini.',
      })),
    ];

    const batch = await completeWineImportBatch(batchId, finalSummary, errors);

    return NextResponse.json({ batchId, batch, summary: finalSummary, errorCount: errors.length }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/wines/import/execute]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import gagal.' },
      { status: 400 },
    );
  }
}
