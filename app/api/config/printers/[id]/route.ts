import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updatePrinterConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { name, group, isActive } = body;
    const data: { name?: string; group?: string; isActive?: boolean } = {};
    if (name !== undefined) data.name = name.trim().toUpperCase();
    if (group !== undefined) data.group = group.trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const printer = await updatePrinterConfig(params.id, data);
    if (!printer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(printer);
  } catch (error) {
    console.error('[PATCH /api/config/printers/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await updatePrinterConfig(params.id, { isActive: false });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/config/printers/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
