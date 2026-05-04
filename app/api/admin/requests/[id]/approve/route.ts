import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Use /done endpoint instead' }, { status: 410 });
}
