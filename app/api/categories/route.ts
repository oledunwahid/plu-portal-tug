import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/session';
import { getCategoriesForOutlet } from '@/lib/categories';
import { PRINTERS_BY_GROUP, OUTLETS_BY_GROUP, getOutletGroup, OutletGroup } from '@/lib/outlets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const outlet = session.user.outlet;
    const outletGroup = getOutletGroup(outlet) as OutletGroup;

    return NextResponse.json({
      categories: getCategoriesForOutlet(outlet),
      printers: PRINTERS_BY_GROUP[outletGroup] ?? [],
      outlets: OUTLETS_BY_GROUP[outletGroup] ?? [],
      outletGroup,
    });
  } catch (error) {
    console.error('[GET /api/categories]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
