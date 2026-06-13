import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterItems } from '@/lib/db';
import { matchImportRows, type MatchInput, type MasterRef } from '@/lib/itemMatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ROWS = 2000;

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

    const inputs: MatchInput[] = rawRows.map((r: Record<string, unknown>) => ({
      name: String(r?.name ?? ''),
      category: String(r?.category ?? ''),
      department: String(r?.department ?? ''),
      barcode: String(r?.barcode ?? ''),
    }));

    // Match against the full active registry (all outlet groups), consistent
    // with the manual PLU code search box.
    const masters = await getMasterItems({ active: true, limit: 100000 });
    const refs: MasterRef[] = masters.map((m) => ({
      code: m.code, name: m.name, category: m.category, department: m.department, barcode: m.barcode, price: m.price,
    }));

    const results = matchImportRows(inputs, refs);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[POST /api/plu/match-batch]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
