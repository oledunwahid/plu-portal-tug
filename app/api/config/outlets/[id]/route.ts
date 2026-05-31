import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateOutletConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { code, group, isActive } = body;
    const data: { code?: string; group?: string; isActive?: boolean } = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (group !== undefined) data.group = group.trim().toUpperCase();
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const outlet = await updateOutletConfig(params.id, data);
    if (!outlet) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(outlet);
  } catch (error) {
    console.error('[PATCH /api/config/outlets/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await updateOutletConfig(params.id, { isActive: false });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/config/outlets/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
