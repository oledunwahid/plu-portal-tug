import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestByIdSimple, updatePLURequest } from '@/lib/db';
import { costControlRejectSchema } from '@/lib/validations';
import { STATUS_PENDING_COST_CONTROL } from '@/lib/costControl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cost control rejects a request: transitions PENDING_COST_CONTROL → REJECTED with a required
// reason, surfaced to the cashier via the existing adminNote column (no new column).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = costControlRejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await getPLURequestByIdSimple(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== STATUS_PENDING_COST_CONTROL) {
      return NextResponse.json({ error: 'Request is not awaiting cost control' }, { status: 409 });
    }

    const updated = await updatePLURequest(params.id, {
      status: 'REJECTED',
      adminNote: parsed.data.reason,
      updatedBy: session.user.name,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[POST /api/cost-control/requests/:id/reject]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
