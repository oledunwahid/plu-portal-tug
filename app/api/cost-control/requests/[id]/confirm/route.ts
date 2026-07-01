import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequestByIdSimple, updatePLURequest } from '@/lib/db';
import { costControlConfirmSchema } from '@/lib/validations';
import { STATUS_PENDING_COST_CONTROL } from '@/lib/costControl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cost control confirms a request: saves the (possibly corrected) barcode and transitions
// PENDING_COST_CONTROL → PENDING, handing it to admin. The transition into PENDING is what makes
// the request appear in the admin notification feed (which excludes PENDING_COST_CONTROL).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'COST_CONTROL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = costControlConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await getPLURequestByIdSimple(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== STATUS_PENDING_COST_CONTROL) {
      return NextResponse.json({ error: 'Request is not awaiting cost control' }, { status: 409 });
    }

    const confirmedBarcode = parsed.data.confirmedBarcode ? parsed.data.confirmedBarcode : null;
    const updated = await updatePLURequest(params.id, {
      confirmedBarcode,
      status: 'PENDING',
      updatedBy: session.user.name,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[POST /api/cost-control/requests/:id/confirm]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
