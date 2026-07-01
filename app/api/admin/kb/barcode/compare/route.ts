import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterMapByCodes, type DbMasterItem } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Returns the master item for each requested batch code so the client can diff the
// uploaded batch against the registry. null = code not present in master (a new item).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const rawCodes = body?.codes;
    if (!Array.isArray(rawCodes)) {
      return NextResponse.json({ error: 'Body must include a "codes" array' }, { status: 400 });
    }

    const codes = rawCodes.filter((c: unknown): c is string => typeof c === 'string' && c.trim() !== '').map((c) => c.trim());
    const map = await getMasterMapByCodes(codes);

    const items: Record<string, DbMasterItem | null> = {};
    for (const code of codes) items[code] = map.get(code) ?? null;

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[POST /api/admin/kb/barcode/compare]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
