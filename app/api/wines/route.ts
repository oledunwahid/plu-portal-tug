import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, stripCostFromAll, wineServerError } from '@/lib/wineApi';
import { createWineSchema } from '@/lib/validations';
import { validateWineFields } from '@/lib/wine';
import { parseWineListParams } from '@/lib/wineListParams';
import {
  getWineMasters,
  countWineMasters,
  checkWineDuplicates,
  createWineMaster,
  getWineVintageOptions,
  getWineOutletOptions,
  getWineListStats,
} from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const { filters, page, limit } = parseWineListParams(searchParams);

    // Pagination is always backend-side - the catalog is ~7k rows and must never be shipped whole.
    const [items, total] = await Promise.all([
      getWineMasters(filters),
      countWineMasters(filters),
    ]);

    const payload: Record<string, unknown> = {
      items: stripCostFromAll(items, guard.canViewCost),
      total,
      page,
      limit,
      canViewCost: guard.canViewCost,
    };

    // Filter option lists change rarely; the client asks for them only on first load.
    if (searchParams.get('withOptions') === '1') {
      const [vintages, outlets, stats] = await Promise.all([
        getWineVintageOptions(),
        getWineOutletOptions(),
        getWineListStats(),
      ]);
      payload.vintages = vintages;
      payload.outlets = outlets;
      payload.stats = stats;
    }

    return NextResponse.json(payload);
  } catch (err) {
    return wineServerError('GET /api/wines', err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireWinePermission('WINE_LIST_CREATE');
  if ('response' in guard) return guard.response;

  try {
    const body = await req.json();
    const parsed = createWineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const fieldIssues = validateWineFields(data);
    if (fieldIssues.length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldIssues }, { status: 400 });
    }

    // Cost is a permissioned field on write as well as read: a caller without WINE_LIST_VIEW_COST
    // must not be able to set (or blank) a value it cannot see.
    const costPerBottle = guard.canViewCost ? data.costPerBottle ?? null : null;

    const duplicates = await checkWineDuplicates({
      masterItemId: data.masterItemId,
      wineName: data.wineName,
      producerId: data.producerId ?? null,
      bottleSizeId: data.bottleSizeId ?? null,
      vintage: data.vintage ?? null,
      isNonVintage: data.isNonVintage,
    });
    if (duplicates.exact.length > 0) {
      return NextResponse.json(
        { error: duplicates.exact[0].message, duplicates },
        { status: 409 },
      );
    }
    if (duplicates.potential.length > 0 && !data.acknowledgeDuplicate) {
      return NextResponse.json(
        { error: 'Potensi duplikat ditemukan.', duplicates, requiresConfirmation: true },
        { status: 409 },
      );
    }

    const result = await createWineMaster(
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
        costPerBottle,
        status: data.status,
        legacyWineCode: data.legacyWineCode ?? null,
        varietals: data.varietals,
      },
      { performedBy: guard.user.id, action: 'CREATE' },
    );

    if (!result.wine) {
      return NextResponse.json({ error: result.error ?? 'Gagal menyimpan wine.' }, { status: 409 });
    }
    return NextResponse.json({ wine: result.wine }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/wines]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
