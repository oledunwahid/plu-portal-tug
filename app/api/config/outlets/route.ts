import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOutletConfigs, createOutletConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const activeOnlyParam = searchParams.get('activeOnly');
    const group = searchParams.get('group') ?? '';

    let outlets = await getOutletConfigs();

    if (outlets.length === 0 && activeOnlyParam === null) {
      console.warn('[GET /api/config/outlets] returned 0 records (dbPath=%s)', process.env.DATABASE_URL);
    }

    if (activeOnlyParam === 'true') {
      outlets = outlets.filter((o) => o.isActive);
    } else if (activeOnlyParam === 'false') {
      outlets = outlets.filter((o) => !o.isActive);
    }

    if (group) {
      const groupOutlets = outlets.filter((o) => o.group === group);
      // CNS cashiers also see IND1 in outlet lists (form visibility only, not group reassignment)
      if (group === 'CNS') {
        const ind1 = outlets.find((o) => o.code === 'IND1');
        if (ind1 && !groupOutlets.find((o) => o.code === 'IND1')) {
          outlets = [...groupOutlets, ind1];
        } else {
          outlets = groupOutlets;
        }
      } else {
        outlets = groupOutlets;
      }
    }

    return NextResponse.json(outlets);
  } catch (error) {
    console.error('[GET /api/config/outlets]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { code, group } = body;
    if (!code?.trim() || !group?.trim()) {
      return NextResponse.json({ error: 'Code and group are required' }, { status: 400 });
    }
    const outlet = await createOutletConfig({ code: code.trim().toUpperCase(), group: group.trim().toUpperCase() });
    return NextResponse.json(outlet, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Outlet code already exists' }, { status: 409 });
  }
}
