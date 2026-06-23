import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getMasterItems, createReconcileSession, insertReconcileRows, upsertSapXevlaBridge,
  getAllSapXevlaBridge, type ReconcileRowInput, type SapXevlaBridgeUpsertInput,
} from '@/lib/db';
import {
  detectCodeType, isItemCode, deriveNckBarcode, buildMatchContext, matchFisikRow,
  type ParsedFisikRow, type ReconcileMasterRef,
} from '@/lib/reconcile';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Header-tolerant cell lookup: normalize each header (lowercase, drop spaces/
// underscores) and match against the accepted spellings. Mirrors the previous
// client-side parser (page.tsx) so row inclusion is unchanged.
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[\s_]/g, '');
    if (keys.includes(norm)) return String(row[k] ?? '').trim();
  }
  return '';
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    const department = (formData.get('department') as string | null)?.trim() || 'ALL';
    const label = (formData.get('label') as string | null)?.trim() || file.name;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Please upload a .xlsx or .csv file.' }, { status: 400 });
    }

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    } catch {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }
    if (wb.SheetNames.length === 0) {
      return NextResponse.json({ error: 'The uploaded file has no sheets.' }, { status: 400 });
    }

    // ── Sheet 1: physical stock ────────────────────────────────────────────────
    const physWs = wb.Sheets[wb.SheetNames[0]];
    const physRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(physWs, { raw: false, defval: '' });

    const parsedRows: ParsedFisikRow[] = [];
    for (const row of physRaw) {
      const code = pick(row, ['itemcode', 'code', 'kodeitem', 'kode']);
      const fisikName = pick(row, ['itemname', 'name', 'namaitem', 'nama']);
      const fisikPrice = num(pick(row, ['price', 'harga', 'sellprice']));
      const fisikQty = num(pick(row, ['qty', 'quantity', 'qtyonhand', 'stock', 'stok']));
      if (!isItemCode(code)) continue;
      if (!fisikName || fisikName === '-') continue;
      if (!((fisikQty != null && fisikQty > 0) || (fisikPrice != null && fisikPrice > 0))) continue;
      parsedRows.push({ fisikCode: code, fisikName, fisikPrice, fisikQty, codeType: detectCodeType(code) });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: 'No valid physical-stock rows found in the first sheet.' }, { status: 400 });
    }

    // ── Master sheet: SAP↔XEVLA↔NCK bridge ─────────────────────────────────────
    // The bridge lives on a sheet named "Master" (case-insensitive); absent in
    // files that only carry the physical count, in which case XEVLA rows fall back
    // to whatever the persisted bridge already knows.
    const masterSheetName = wb.SheetNames.find((n) => /master/i.test(n));
    const bridgeInputs: SapXevlaBridgeUpsertInput[] = [];
    if (masterSheetName) {
      const masterRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[masterSheetName], { raw: false, defval: '' });
      const seen = new Set<string>();
      for (const row of masterRaw) {
        const sapRaw = pick(row, ['sap']);
        const sapCode = sapRaw.replace(/\D/g, '');
        if (!sapCode) continue;                 // skip rows with a blank SAP
        if (seen.has(sapCode)) continue;        // first occurrence wins within the file
        seen.add(sapCode);
        const sapNckCell = pick(row, ['sapnck']);
        const xevlaRaw = pick(row, ['xevla']);
        const xevlaCode = xevlaRaw.replace(/\D/g, '') || null;
        // NCK barcode from the SAP NCK cell (digits + 11); fall back to the SAP code.
        const nckBarcode = deriveNckBarcode(sapNckCell || sapCode);
        bridgeInputs.push({ sapCode, xevlaCode, nckBarcode, itemName: pick(row, ['itemname', 'name']) });
      }
    }

    // ── Persist session, bridge; then run the cascade and persist rows ─────────
    const sessionId = await createReconcileSession(label, department);
    const bridgeResult = bridgeInputs.length > 0
      ? await upsertSapXevlaBridge(bridgeInputs, sessionId)
      : { inserted: 0, updated: 0 };

    // Masters scoped to the session department (when not ALL) — this both keeps the
    // fuzzy name step from matching across departments and keeps "not in fisik"
    // meaningful. The full persisted bridge (not just this file's) feeds the cascade.
    const masterItems = await getMasterItems({
      department: department !== 'ALL' ? department : undefined,
      active: true, limit: 100000,
    });
    const masters: ReconcileMasterRef[] = masterItems.map((m) => ({
      code: m.code, name: m.name, price: m.price, barcode: m.barcode,
    }));
    const bridge = await getAllSapXevlaBridge();
    const ctx = buildMatchContext(masters, bridge);

    const rowInputs: ReconcileRowInput[] = parsedRows.map((r) => {
      const o = matchFisikRow(r, ctx);
      return {
        fisikCode: r.fisikCode, fisikName: r.fisikName, fisikPrice: r.fisikPrice, fisikQty: r.fisikQty,
        codeType: r.codeType, matchedMasterCode: o.matchedMasterCode, matchedMasterName: o.matchedMasterName,
        matchedMasterPrice: o.matchedMasterPrice, matchConfidence: o.matchConfidence,
        matchMethod: o.matchMethod, priceMatch: o.priceMatch,
      };
    });
    await insertReconcileRows(sessionId, rowInputs);

    const matched = rowInputs.filter((r) => r.matchedMasterCode != null).length;
    const notInCloud = rowInputs.length - matched;
    const priceMismatch = rowInputs.filter((r) => r.matchedMasterCode != null && r.priceMatch === false).length;

    return NextResponse.json({
      sessionId,
      summary: {
        total: rowInputs.length, matched, notInCloud, priceMismatch,
        bridgeInserted: bridgeResult.inserted, bridgeUpdated: bridgeResult.updated,
        masterSheetFound: !!masterSheetName,
      },
    });
  } catch (err) {
    console.error('[POST /api/admin/kb/reconcile/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
