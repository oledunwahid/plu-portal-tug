import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCategoryConfigs, createCategoryConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const activeOnlyParam = searchParams.get('activeOnly');

    let categories = await getCategoryConfigs();

    if (categories.length === 0 && activeOnlyParam === null) {
      console.warn('[GET /api/config/categories] returned 0 records (dbPath=%s)', process.env.DATABASE_URL);
    }

    if (activeOnlyParam === 'true') {
      categories = categories.filter((c) => c.isActive);
    } else if (activeOnlyParam === 'false') {
      categories = categories.filter((c) => !c.isActive);
    }
    // activeOnlyParam === null → return all records, no filter

    return NextResponse.json(categories);
  } catch (error) {
    console.error('[GET /api/config/categories]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { name, department, departmentCode, categoryCode } = body;
    if (!name?.trim() || !department?.trim() || !departmentCode || !categoryCode) {
      return NextResponse.json({ error: 'Name, department, departmentCode, and categoryCode are required' }, { status: 400 });
    }
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
