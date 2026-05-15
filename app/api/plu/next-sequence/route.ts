import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getNextPLUSequence } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const prefix   = searchParams.get('prefix');
    const deptCode = searchParams.get('deptCode');
    const catCode  = searchParams.get('catCode');

    if (!prefix || !deptCode || !catCode) {
      return NextResponse.json({ error: 'Missing required parameters: prefix, deptCode, catCode' }, { status: 400 });
    }

    const sequence = await getNextPLUSequence(prefix, deptCode, catCode);
    return NextResponse.json({ sequence });
  } catch (error) {
    console.error('[GET /api/plu/next-sequence]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
