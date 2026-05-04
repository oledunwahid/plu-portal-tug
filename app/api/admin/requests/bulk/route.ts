import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Use /api/admin/bulk-done instead' }, { status: 410 });
}
