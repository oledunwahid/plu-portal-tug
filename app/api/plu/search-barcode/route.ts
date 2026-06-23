import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getMasterItemsByExactBarcode, getSapMasterItemsByExactBarcode, type DbMasterItem, type DbSapMasterItem,
} from '@/lib/db';
import { deriveNckBarcode } from '@/lib/barcode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Result shape consumed by PLUCodeSearch (barcode mode). `sapOnly` rows have no
// Quinos master code/price — they exist in the SAP registry but are not (yet)
// verified in the Quinos master, so the cashier is warned before relying on them.
interface BarcodeResult {
  code: string | null;
  name: string;
  category: string | null;
  folder: string | null;
  price: number | null;
  barcode: string | null;
  source: 'MASTER' | 'SAP';
  sapOnly: boolean;
  matchType: 'EXACT' | 'NCK';
  sapItemNo: string | null;
}

function masterToResult(m: DbMasterItem, matchType: 'EXACT' | 'NCK'): BarcodeResult {
  return {
    code: m.code, name: m.name, category: m.category, folder: m.folder, price: m.price,
    barcode: m.barcode, source: 'MASTER', sapOnly: false, matchType, sapItemNo: null,
  };
}

// Exact barcode first; if nothing, retry with the NCK-derived barcode (digits + 11).
// Returns the rows plus how they matched, so the UI can label confidence.
async function lookupMaster(raw: string, derived: string): Promise<{ rows: DbMasterItem[]; matchType: 'EXACT' | 'NCK' }> {
  const exact = await getMasterItemsByExactBarcode(raw);
  if (exact.length > 0) return { rows: exact, matchType: 'EXACT' };
  if (derived && derived !== raw.trim()) {
    const nck = await getMasterItemsByExactBarcode(derived);
    if (nck.length > 0) return { rows: nck, matchType: 'NCK' };
  }
  return { rows: [], matchType: 'EXACT' };
}

async function lookupSap(raw: string, derived: string): Promise<{ rows: DbSapMasterItem[]; matchType: 'EXACT' | 'NCK' }> {
  const exact = await getSapMasterItemsByExactBarcode(raw);
  if (exact.length > 0) return { rows: exact, matchType: 'EXACT' };
  if (derived && derived !== raw.trim()) {
    const nck = await getSapMasterItemsByExactBarcode(derived);
    if (nck.length > 0) return { rows: nck, matchType: 'NCK' };
  }
  return { rows: [], matchType: 'EXACT' };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const raw = (new URL(request.url).searchParams.get('barcode') ?? '').trim();
    if (!raw) return NextResponse.json({ input: '', results: [], notFound: false });

    // NCK fallback string is shared by both sources (strip non-digits, append 11).
    const derived = deriveNckBarcode(raw);

    // Both sources run in parallel.
    const [masterHit, sapHit] = await Promise.all([lookupMaster(raw, derived), lookupSap(raw, derived)]);

    const results: BarcodeResult[] = [];
    const seenCodes = new Set<string>();

    // Source 1 (Quinos master) — authoritative, listed first.
    for (const m of masterHit.rows) {
      if (seenCodes.has(m.code)) continue;
      seenCodes.add(m.code);
      results.push(masterToResult(m, masterHit.matchType));
    }

    // Source 2 (SAP). Each SAP hit is resolved to a master item by its own barcode:
    //  - resolves to a master already in results → duplicate, skip (dedup by code)
    //  - resolves to a master not yet listed   → it IS verified, add as a master row
    //  - resolves to no master                 → SAP-only, surface with the warning
    for (const s of sapHit.rows) {
      const masterForSap = s.barcode ? await getMasterItemsByExactBarcode(s.barcode) : [];
      if (masterForSap.length > 0) {
        for (const m of masterForSap) {
          if (seenCodes.has(m.code)) continue;
          seenCodes.add(m.code);
          results.push(masterToResult(m, sapHit.matchType));
        }
      } else {
        results.push({
          code: null, name: s.description, category: s.subGroup, folder: null, price: null,
          barcode: s.barcode, source: 'SAP', sapOnly: true, matchType: sapHit.matchType, sapItemNo: s.itemNo,
        });
      }
    }

    return NextResponse.json({ input: raw, results, notFound: results.length === 0 });
  } catch (err) {
    console.error('[GET /api/plu/search-barcode]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
