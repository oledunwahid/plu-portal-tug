import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWikiArticles, createWikiArticle } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const articles = await getWikiArticles();
    return NextResponse.json(articles);
  } catch (err) {
    console.error('[GET /api/admin/kb/wiki]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

    const article = await createWikiArticle({
      title: body.title.trim(),
      content: body.content ?? '',
      category: body.category?.trim() || 'General',
      isPinned: body.isPinned === true,
      createdBy: session.user.id,
    });

    return NextResponse.json(article, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/kb/wiki]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
