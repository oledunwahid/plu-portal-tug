import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Reject is no longer supported' }, { status: 410 });
}
