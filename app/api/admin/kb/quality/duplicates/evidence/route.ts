import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getLightGroupsCached, getSapIndexCached } from '@/lib/dupCache';
import { computeGroupEvidence } from '@/lib/dupAnalysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Lazy SAP evidence for a single duplicate group. SAP eligibility is gated by
// candidate presence (the token prefilter), not department: a group whose names
// don't overlap the SAP registry returns an empty match set almost instantly.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COST_CONTROL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const groupId = req.nextUrl.searchParams.get('groupId');
    if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

    const { byKey } = await getLightGroupsCached();
    const group = byKey.get(groupId);
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const sapIndex = await getSapIndexCached();
    const evidence = computeGroupEvidence(group.masterItems, group.base, sapIndex);

    return NextResponse.json(evidence);
  } catch (err) {
    console.error('[GET /api/admin/kb/quality/duplicates/evidence]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
