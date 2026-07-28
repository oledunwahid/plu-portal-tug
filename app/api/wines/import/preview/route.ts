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
} from '@/lib/wineImport';
import { buildWineImportLookup } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PREVIEW_ROWS = 200;

function readMapping(raw: string | null, headers: string[]): WineColumnMapping | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapping: WineColumnMapping = {};
    for (const field of WINE_IMPORT_FIELDS) {
      const column = parsed[field];
      // Ignore any column the file doesn't actually have - a stale mapping must not silently read
      // the wrong data.
      if (typeof column === 'string' && headers.includes(column)) mapping[field] = column;
    }
    return mapping;
  } catch {
    return null;
  }
}

/**
 * Upload → sheet choice → column mapping → validated preview, in one endpoint that can be called
 * repeatedly as the user adjusts the sheet or the mapping. Nothing is written here.
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

    // Without a Wine Name column nothing can be validated - return the mapping step only.
    if (!mapping.wineName) {
      return NextResponse.json({
        fileName: file.name,
        sheetNames: parsed.sheetNames,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        mapping,
        needsMapping: true,
        totalRows: parsed.rows.length,
        error: 'Kolom Wine Name belum dipetakan.',
      });
    }

    const rows = parsed.rows.map((row) => parseWineImportRow(row, mapping));
    const lookup = await buildWineImportLookup();
    const plan = planWineImport(rows, lookup);
    const summary = summarizeWineImport(plan);

    return NextResponse.json({
      fileName: file.name,
      sheetNames: parsed.sheetNames,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      mapping,
      needsMapping: false,
      totalRows: plan.length,
      summary,
      // Cap the payload - a 7k-row file would otherwise ship the whole catalog to the browser.
      preview: plan.slice(0, MAX_PREVIEW_ROWS),
      previewTruncated: plan.length > MAX_PREVIEW_ROWS,
      errors: importErrorRows(plan).slice(0, MAX_PREVIEW_ROWS),
    });
  } catch (err) {
    console.error('[POST /api/wines/import/preview]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membaca file.' },
      { status: 400 },
    );
  }
}
