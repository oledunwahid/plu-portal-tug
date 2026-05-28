import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCategoryConfigs, createCategoryConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const categories = await getCategoryConfigs();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { name, department, departmentCode, categoryCode } = body;
  if (!name?.trim() || !department?.trim() || !departmentCode || !categoryCode) {
    return NextResponse.json({ error: 'Name, department, departmentCode, and categoryCode are required' }, { status: 400 });
  }
  try {
    const cat = await createCategoryConfig({
      name: name.trim(),
      department: department.trim(),
      departmentCode: Number(departmentCode),
      categoryCode: Number(categoryCode),
    });
    return NextResponse.json(cat, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
  }
}
