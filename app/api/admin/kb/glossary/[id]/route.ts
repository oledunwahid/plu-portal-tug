import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateGlossaryEntry, deleteGlossaryEntry } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    if (!body.definition?.trim()) return NextResponse.json({ error: 'Definition is required.' }, { status: 400 });

    const updated = await updateGlossaryEntry(params.id, {
      definition: body.definition.trim(),
      grp: body.grp !== undefined ? (body.grp?.trim() || null) : undefined,
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/admin/kb/glossary/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await deleteGlossaryEntry(params.id);
    if (!result.deleted) {
      if (result.reason === 'seeded') {
        return NextResponse.json({ error: 'Seeded entries cannot be deleted.' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/admin/kb/glossary/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
