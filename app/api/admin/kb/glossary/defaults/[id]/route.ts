import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGlossaryEntries } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const entries = await getGlossaryEntries();
    const entry = entries.find((e) => e.id === params.id);
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!entry.isSeeded) return NextResponse.json({ error: 'Entry is not seeded.' }, { status: 400 });

    return NextResponse.json({ defaultDefinition: entry.defaultDefinition ?? entry.definition });
  } catch (err) {
    console.error('[GET /api/admin/kb/glossary/defaults/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
