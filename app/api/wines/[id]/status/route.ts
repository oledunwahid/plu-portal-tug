import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, stripCost } from '@/lib/wineApi';
import { wineStatusSchema } from '@/lib/validations';
import { setWineMasterStatus } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Active ⇄ Inactive only. There is no DELETE handler anywhere under /api/wines: a wine is never
 * removed (rule 15), and every transition is written to WineAuditLog by setWineMasterStatus.
 *
 * Deactivating a Wine Master deliberately does NOT touch the linked Master Item - taking a wine off
 * the Wine List is a catalog decision, while deactivating the PLU is a POS change that belongs to the
 * normal Remove PLU request flow.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireWinePermission('WINE_LIST_CHANGE_STATUS');
  if ('response' in guard) return guard.response;

  try {
    const body = await req.json();
    const parsed = wineStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const result = await setWineMasterStatus(params.id, parsed.data.status, {
      performedBy: guard.user.id,
      reason: parsed.data.reason ?? null,
    });
    if (!result.wine) {
      const notFound = result.error === 'Wine tidak ditemukan.';
      return NextResponse.json({ error: result.error ?? 'Gagal mengubah status.' }, { status: notFound ? 404 : 409 });
    }
    return NextResponse.json({ wine: stripCost(result.wine, guard.canViewCost) });
  } catch (err) {
    console.error(`[PATCH /api/wines/${params.id}/status]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
