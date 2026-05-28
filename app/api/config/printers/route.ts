import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPrinterConfigs, createPrinterConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const printers = await getPrinterConfigs();
  return NextResponse.json(printers);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { name, group } = body;
  if (!name?.trim() || !group?.trim()) {
    return NextResponse.json({ error: 'Name and group are required' }, { status: 400 });
  }
  try {
    const printer = await createPrinterConfig({ name: name.trim().toUpperCase(), group: group.trim() });
    return NextResponse.json(printer, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Printer name already exists' }, { status: 409 });
  }
}
