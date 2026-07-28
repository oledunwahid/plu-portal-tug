import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { publishWineRequestSchema } from '@/lib/validations';
import { validateWineFields } from '@/lib/wine';
import {
  getPendingPublicationRequest,
  checkWineDuplicates,
  publishRequestToWineList,
} from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET returns the publish preview: request data + resolved Master Item + duplicate findings. */
export async function GET(_req: NextRequest, { params }: { params: { requestId: string } }) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const request = await getPendingPublicationRequest(params.requestId);
    if (!request) return NextResponse.json({ error: 'Request tidak ditemukan.' }, { status: 404 });

    const duplicates = await checkWineDuplicates({
      masterItemId: request.masterItemId,
      sourceRequestId: request.requestId,
      // Seed the name check with the request's item name - the wine team usually keeps it or refines it.
      wineName: request.itemName,
    });

    return NextResponse.json({ request, duplicates });
  } catch (err) {
    return wineServerError(`GET /api/wines/publish-request/${params.requestId}`, err);
  }
}

/**
 * Publish a DONE wine request into the Wine List.
 *
 * The write is atomic (see publishRequestToWineList): the Wine Master insert and the request's
 * publishedToWineList stamp land together, and sourceRequestId is uniquely indexed - so a
 * double-click, a retry, or two users publishing the same request produces exactly one wine.
 */
export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  const guard = await requireWinePermission('WINE_LIST_CREATE');
  if ('response' in guard) return guard.response;

  try {
    const request = await getPendingPublicationRequest(params.requestId);
    if (!request) return NextResponse.json({ error: 'Request tidak ditemukan.' }, { status: 404 });
    if (!request.masterItemId) {
      return NextResponse.json(
        {
          error: 'Master Item untuk request ini belum tersedia di registry. Import master item terlebih dahulu.',
        },
        { status: 409 },
      );
    }

    const body = await req.json();
    const parsed = publishWineRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;

    // The Master Item must be the one this request actually produced - a client cannot redirect the
    // publish at an unrelated PLU.
    if (data.masterItemId !== request.masterItemId) {
      return NextResponse.json(
        { error: 'Master Item tidak sesuai dengan request ini.' },
        { status: 400 },
      );
    }

    const fieldIssues = validateWineFields(data);
    if (fieldIssues.length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldIssues }, { status: 400 });
    }

    const duplicates = await checkWineDuplicates({
      masterItemId: data.masterItemId,
      sourceRequestId: params.requestId,
      wineName: data.wineName,
      producerId: data.producerId ?? null,
      bottleSizeId: data.bottleSizeId ?? null,
      vintage: data.vintage ?? null,
      isNonVintage: data.isNonVintage,
    });
    if (duplicates.exact.length > 0) {
      return NextResponse.json({ error: duplicates.exact[0].message, duplicates }, { status: 409 });
    }
    if (duplicates.potential.length > 0 && !data.acknowledgeDuplicate) {
      return NextResponse.json(
        { error: 'Potensi duplikat ditemukan.', duplicates, requiresConfirmation: true },
        { status: 409 },
      );
    }

    const result = await publishRequestToWineList(
      params.requestId,
      {
        masterItemId: data.masterItemId,
        wineName: data.wineName,
        displayName: data.displayName ?? null,
        producerId: data.producerId ?? null,
        countryId: data.countryId ?? null,
        regionId: data.regionId ?? null,
        appellationId: data.appellationId ?? null,
        classificationId: data.classificationId ?? null,
        wineTypeId: data.wineTypeId ?? null,
        categoryId: data.categoryId ?? null,
        subCategory1Id: data.subCategory1Id ?? null,
        subCategory2Id: data.subCategory2Id ?? null,
        bottleSizeId: data.bottleSizeId ?? null,
        vintage: data.vintage ?? null,
        isNonVintage: data.isNonVintage,
        abv: data.abv ?? null,
        description: data.description ?? null,
        tastingNotes: data.tastingNotes ?? null,
        foodPairing: data.foodPairing ?? null,
        servingTemperature: data.servingTemperature ?? null,
        internalNotes: data.internalNotes ?? null,
        costPerBottle: guard.canViewCost ? data.costPerBottle ?? null : null,
        status: data.status,
        varietals: data.varietals,
      },
      { performedBy: guard.user.id, performedByName: guard.user.name },
    );

    if (!result.wine) {
      return NextResponse.json({ error: result.error ?? 'Gagal mempublikasikan request.' }, { status: 409 });
    }
    return NextResponse.json({ wine: result.wine }, { status: 201 });
  } catch (err) {
    console.error(`[POST /api/wines/publish-request/${params.requestId}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
