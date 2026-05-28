import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateCategoryConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { name, department, departmentCode, categoryCode, isActive } = body;
  const data: { name?: string; department?: string; departmentCode?: number; categoryCode?: number; isActive?: boolean } = {};
  if (name !== undefined) data.name = name.trim();
  if (department !== undefined) data.department = department.trim();
  if (departmentCode !== undefined) data.departmentCode = Number(departmentCode);
  if (categoryCode !== undefined) data.categoryCode = Number(categoryCode);
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  const cat = await updateCategoryConfig(params.id, data);
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(cat);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await updateCategoryConfig(params.id, { isActive: false });
  return NextResponse.json({ ok: true });
}
