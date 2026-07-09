import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterItems, getMasterItemsByCodes, getAllSapItemsForMatch, type DbMasterItem } from '@/lib/db';
import {
  matchImportRows, buildCodeMatch, normalizeCode,
  type MatchInput, type MasterRef, type RowMatch,
} from '@/lib/itemMatch';
import { annotateWineWarnings, isWineDepartment, type SapRef } from '@/lib/wineChecks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Secondary safety net: large files (e.g. Pierre's 640-row CSV) resolve mostly
// via the exact-code fast path below, but raise the ceiling in case a batch is
// heavy on fuzzy rows.
export const maxDuration = 60;

const MAX_ROWS = 2000;

function toRef(m: DbMasterItem): MasterRef {
  return {
    code: m.code, name: m.name, category: m.category, department: m.department,
    barcode: m.barcode, price: m.price, priceLevels: m.priceLevels,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const rawRows = body?.rows;
    if (!Array.isArray(rawRows)) {
      return NextResponse.json({ error: 'Body must include a "rows" array' }, { status: 400 });
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
    }

    // Trim every incoming field. Some source files carry stray whitespace
    // (e.g. Pierre's trailing-space categories like 'FRANCE '); trimming here
    // keeps the exact-match keys clean before any lookup.
    const inputs: MatchInput[] = rawRows.map((r: Record<string, unknown>) => ({
      code: String(r?.code ?? '').trim(),
      name: String(r?.name ?? '').trim(),
      category: String(r?.category ?? '').trim(),
      department: String(r?.department ?? '').trim(),
      barcode: String(r?.barcode ?? '').trim(),
    }));

    const results: RowMatch[] = new Array(inputs.length);
    const masterByCode = new Map<string, MasterRef>();

    // ── Phase 1: exact Code (single batched WHERE code IN query) ────────────
    // Files that carry Code (e.g. Pierre's) resolve here without ever loading
    // or fuzzy-scanning the 21k-row registry — the source of the timeout.
    const codes = inputs.map((i) => normalizeCode(i.code)).filter(Boolean);
    if (codes.length) {
      for (const m of await getMasterItemsByCodes(codes)) {
        masterByCode.set(m.code, toRef(m));
      }
    }

    const unresolved: number[] = [];
    inputs.forEach((input, i) => {
      const code = normalizeCode(input.code);
      const ref = code ? masterByCode.get(code) : undefined;
      if (ref) results[i] = buildCodeMatch(input, ref);
      else unresolved.push(i);
    });

    // ── Phase 2: barcode / name+cat / fuzzy for the remainder ───────────────
    // Only now — and only if something is still unresolved — do we pay to load
    // the full active registry (all outlet groups), consistent with the manual
    // PLU code search box.
    if (unresolved.length) {
      const masters = await getMasterItems({ active: true, limit: 100000 });
      const refs: MasterRef[] = masters.map(toRef);
      for (const r of refs) if (!masterByCode.has(r.code)) masterByCode.set(r.code, r);
      const sub = matchImportRows(unresolved.map((i) => inputs[i]), refs);
      unresolved.forEach((idx, k) => { results[idx] = sub[k]; });
    }

    // Wine-only advisory pass: barcode integrity (SAP cross-check) + active
    // price-levels warning. Only loads the SAP registry when a wine row exists.
    let finalResults = results;
    if (inputs.some((i) => isWineDepartment(i.department))) {
      const saps = await getAllSapItemsForMatch();
      const sapRefs: SapRef[] = saps.map((s) => ({ itemNo: s.itemNo, description: s.description, barcode: s.barcode }));
      finalResults = annotateWineWarnings(inputs, results, masterByCode, sapRefs);
    }

    return NextResponse.json({ results: finalResults });
  } catch (error) {
    console.error('[POST /api/plu/match-batch]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
