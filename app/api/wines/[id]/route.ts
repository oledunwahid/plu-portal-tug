import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, stripCost, wineServerError } from '@/lib/wineApi';
import { updateWineSchema } from '@/lib/validations';
import { validateWineFields } from '@/lib/wine';
import {
  getWineMasterById,
  getWineVarietals,
  getWineAuditLogs,
  updateWineMaster,
  checkWineDuplicates,
} from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const wine = await getWineMasterById(params.id);
    if (!wine) return NextResponse.json({ error: 'Wine tidak ditemukan.' }, { status: 404 });

    const [varietals, auditLogs] = await Promise.all([
      getWineVarietals(params.id),
      getWineAuditLogs(params.id),
    ]);

    return NextResponse.json({
      wine: stripCost(wine, guard.canViewCost),
      varietals,
      auditLogs,
      canViewCost: guard.canViewCost,
    });
  } catch (err) {
    return wineServerError(`GET /api/wines/${params.id}`, err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireWinePermission('WINE_LIST_EDIT');
  if ('response' in guard) return guard.response;

  try {
    const existing = await getWineMasterById(params.id);
    if (!existing) return NextResponse.json({ error: 'Wine tidak ditemukan.' }, { status: 404 });

    const body = await req.json();
    const parsed = updateWineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }
    const { expectedUpdatedAt, acknowledgeDuplicate, ...data } = parsed.data;

    // Validate the merged record, not the patch: a partial payload must still leave a legal wine
    // (e.g. clearing the vintage without setting Non-Vintage has to fail).
    const merged = {
      wineName: data.wineName ?? existing.wineName,
      producerId: 'producerId' in data ? data.producerId : existing.producerId,
      bottleSizeId: 'bottleSizeId' in data ? data.bottleSizeId : existing.bottleSizeId,
      wineTypeId: 'wineTypeId' in data ? data.wineTypeId : existing.wineTypeId,
      vintage: 'vintage' in data ? data.vintage ?? null : existing.vintage,
      isNonVintage: 'isNonVintage' in data ? data.isNonVintage === true : existing.isNonVintage,
      abv: 'abv' in data ? data.abv ?? null : existing.abv,
      costPerBottle: 'costPerBottle' in data ? data.costPerBottle ?? null : existing.costPerBottle,
    };
    const fieldIssues = validateWineFields(merged);
    if (fieldIssues.length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldIssues }, { status: 400 });
    }

    // Re-run the potential-duplicate check if any part of the identity key moved.
    const identityChanged =
      ('wineName' in data && data.wineName !== existing.wineName) ||
      ('vintage' in data && (data.vintage ?? null) !== existing.vintage) ||
      ('isNonVintage' in data && data.isNonVintage !== existing.isNonVintage) ||
      ('bottleSizeId' in data && (data.bottleSizeId ?? null) !== existing.bottleSizeId) ||
      ('producerId' in data && (data.producerId ?? null) !== existing.producerId);

    if (identityChanged) {
      const duplicates = await checkWineDuplicates({
        wineName: merged.wineName,
        producerId: merged.producerId,
        bottleSizeId: merged.bottleSizeId,
        vintage: merged.vintage,
        isNonVintage: merged.isNonVintage,
        excludeWineId: params.id,
      });
      if (duplicates.potential.length > 0 && !acknowledgeDuplicate) {
        return NextResponse.json(
          { error: 'Potensi duplikat ditemukan.', duplicates, requiresConfirmation: true },
          { status: 409 },
        );
      }
    }

    // Silently drop a cost edit from a caller who cannot see cost, rather than letting it overwrite.
    const payload = { ...data };
    if (!guard.canViewCost) delete payload.costPerBottle;

    const result = await updateWineMaster(params.id, payload, {
      performedBy: guard.user.id,
      expectedUpdatedAt: expectedUpdatedAt ?? null,
    });
    if (!result.wine) {
      return NextResponse.json(
        { error: result.error ?? 'Gagal menyimpan wine.' },
        { status: result.conflict ? 409 : 400 },
      );
    }
    return NextResponse.json({ wine: stripCost(result.wine, guard.canViewCost) });
  } catch (err) {
    console.error(`[PATCH /api/wines/${params.id}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
