import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterItems, countMasterItems, getMasterItemsLastImported, getMasterItemDepartments } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const department = searchParams.get('department') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const outlet = searchParams.get('outlet') ?? undefined;
    const activeParam = searchParams.get('active');
    const active = activeParam === '1' ? true : activeParam === '0' ? false : null;
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Number(limitParam), 200) : 20;
    const offset = (page - 1) * limit;

    const filters = { search, outletGroup, department, category, outlet, active: active ?? undefined, limit, offset };
    const countFilters = { search, outletGroup, department, category, outlet, active: active ?? undefined };
    const [items, total, lastImported, departments] = await Promise.all([
      getMasterItems(filters),
      countMasterItems(countFilters),
      getMasterItemsLastImported(),
      getMasterItemDepartments(),
    ]);

    return NextResponse.json({ items, total, page, limit, lastImported, departments });
  } catch (err) {
    console.error('[GET /api/admin/kb/items]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
