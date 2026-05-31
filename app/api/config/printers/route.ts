import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPrinterConfigs, createPrinterConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const activeOnlyParam = searchParams.get('activeOnly');
    const group = searchParams.get('group') ?? '';

    let printers = await getPrinterConfigs();

    if (printers.length === 0 && activeOnlyParam === null) {
      console.warn('[GET /api/config/printers] returned 0 records (dbPath=%s)', process.env.DATABASE_URL);
    }

    if (activeOnlyParam === 'true') {
      printers = printers.filter((p) => p.isActive);
    } else if (activeOnlyParam === 'false') {
      printers = printers.filter((p) => !p.isActive);
    }
    // activeOnlyParam === null → return all records, no filter

    if (group) printers = printers.filter((p) => p.group === group || p.group === 'ALL');

    return NextResponse.json(printers);
  } catch (error) {
    console.error('[GET /api/config/printers]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { name, group } = body;
    if (!name?.trim() || !group?.trim()) {
      return NextResponse.json({ error: 'Name and group are required' }, { status: 400 });
    }
    const printer = await createPrinterConfig({ name: name.trim().toUpperCase(), group: group.trim() });
    return NextResponse.json(printer, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Printer name already exists' }, { status: 409 });
  }
}
