import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getSapMasterItems, countSapMasterItems, getSapMasterItemsLastImported, getSapSubGroups } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? undefined;
    const subGroup = searchParams.get('subGroup') ?? undefined;
    const isExport = searchParams.get('export') === 'true' || searchParams.get('export') === '1';

    if (isExport) {
      const items = await getSapMasterItems({ search, subGroup, limit: 100000, offset: 0 });
      return NextResponse.json({ items });
    }

    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const [items, total, lastImported, subGroups] = await Promise.all([
      getSapMasterItems({ search, subGroup, limit, offset }),
      countSapMasterItems({ search, subGroup }),
      getSapMasterItemsLastImported(),
      getSapSubGroups(),
    ]);

    return NextResponse.json({ items, total, page, limit, lastImported, subGroups });
  } catch (err) {
    console.error('[GET /api/admin/kb/sap-items]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
