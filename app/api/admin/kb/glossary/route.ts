import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGlossaryEntries, createGlossaryEntry } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const entries = await getGlossaryEntries();
    return NextResponse.json(entries);
  } catch (err) {
    console.error('[GET /api/admin/kb/glossary]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    if (!body.term?.trim()) return NextResponse.json({ error: 'Term is required.' }, { status: 400 });
    if (!body.type?.trim()) return NextResponse.json({ error: 'Type is required.' }, { status: 400 });
    if (!body.definition?.trim()) return NextResponse.json({ error: 'Definition is required.' }, { status: 400 });

    const existing = await getGlossaryEntries();
    const dup = existing.find(
      (e) => e.term.toLowerCase() === body.term.trim().toLowerCase() && e.type === body.type.trim()
    );
    if (dup) {
      return NextResponse.json({
        error: `A glossary entry for '${body.term.trim()}' (${body.type.trim()}) already exists. Edit the existing entry instead.`,
      }, { status: 409 });
    }

    const entry = await createGlossaryEntry({
      type: body.type.trim(),
      term: body.term.trim(),
      definition: body.definition.trim(),
      grp: body.grp?.trim() || null,
      isSeeded: false,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/kb/glossary]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
