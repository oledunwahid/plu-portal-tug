import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { searchMasterItems, countMasterItems } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q = new URL(req.url).searchParams.get('q') ?? '';
    if (!q.trim()) return NextResponse.json({ items: [], total: 0 });

    const [items, total] = await Promise.all([
      searchMasterItems(q.trim(), 10),
      countMasterItems({ search: q.trim() }),
    ]);

    return NextResponse.json({ items, total });
  } catch (err) {
    console.error('[GET /api/admin/kb/barcode]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
