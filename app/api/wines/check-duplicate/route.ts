import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission } from '@/lib/wineApi';
import { wineDuplicateCheckSchema } from '@/lib/validations';
import { checkWineDuplicates } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Pre-flight duplicate check so the form can warn before the user hits Save. The same check runs
 * again inside POST /api/wines and the publish route - this endpoint is a convenience, never the
 * enforcement point.
 */
export async function POST(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const body = await req.json();
    const parsed = wineDuplicateCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }
    const duplicates = await checkWineDuplicates({
      masterItemId: parsed.data.masterItemId ?? null,
      sourceRequestId: parsed.data.sourceRequestId ?? null,
      wineName: parsed.data.wineName ?? null,
      producerId: parsed.data.producerId ?? null,
      bottleSizeId: parsed.data.bottleSizeId ?? null,
      vintage: parsed.data.vintage ?? null,
      isNonVintage: parsed.data.isNonVintage === true,
      excludeWineId: parsed.data.excludeWineId ?? null,
    });
    return NextResponse.json({
      duplicates,
      blocked: duplicates.exact.length > 0,
      requiresConfirmation: duplicates.exact.length === 0 && duplicates.potential.length > 0,
    });
  } catch (err) {
    console.error('[POST /api/wines/check-duplicate]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
