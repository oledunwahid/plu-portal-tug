import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterItemsByCodes } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Bulk lookup of master items by exact code — used to populate reference fields for large batches in one request
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const codes: string[] = Array.isArray(body?.codes)
      ? body.codes.filter((c: unknown): c is string => typeof c === 'string' && c.trim() !== '')
      : [];
    if (codes.length === 0) return NextResponse.json({ items: [] });

    const items = await getMasterItemsByCodes(codes);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[POST /api/admin/kb/items/lookup]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
