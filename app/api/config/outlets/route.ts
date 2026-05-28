import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getOutletConfigs, createOutletConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const outlets = await getOutletConfigs();
  return NextResponse.json(outlets);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { code, group } = body;
  if (!code?.trim() || !group?.trim()) {
    return NextResponse.json({ error: 'Code and group are required' }, { status: 400 });
  }
  try {
    const outlet = await createOutletConfig({ code: code.trim().toUpperCase(), group: group.trim().toUpperCase() });
    return NextResponse.json(outlet, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Outlet code already exists' }, { status: 409 });
  }
}
