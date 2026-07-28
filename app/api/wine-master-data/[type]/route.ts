import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission, wineServerError } from '@/lib/wineApi';
import { wineMasterDataCreateSchema } from '@/lib/validations';
import { isWineMasterDataType, WINE_MASTER_DATA_TYPES } from '@/lib/wine';
import { getWineMasterData, createWineMasterDataItem } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** `type` = one of WINE_MASTER_DATA_TYPES, or `ALL` on GET to load every dropdown in one request. */
export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const guard = await requireWinePermission('WINE_LIST_VIEW');
  if ('response' in guard) return guard.response;

  try {
    const type = params.type.toUpperCase();
    if (type !== 'ALL' && !isWineMasterDataType(type)) {
      return NextResponse.json(
        { error: `Tipe master data tidak dikenal. Pilihan: ${WINE_MASTER_DATA_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    const { searchParams } = new URL(req.url);
    const items = await getWineMasterData(type === 'ALL' ? undefined : type, {
      search: searchParams.get('search') ?? undefined,
      includeInactive: searchParams.get('includeInactive') === '1',
      limit: Number(searchParams.get('limit') ?? 5000),
    });
    return NextResponse.json({ items });
  } catch (err) {
    return wineServerError(`GET /api/wine-master-data/${params.type}`, err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const guard = await requireWinePermission('WINE_LIST_MANAGE_MASTER_DATA');
  if ('response' in guard) return guard.response;

  try {
    const type = params.type.toUpperCase();
    if (!isWineMasterDataType(type)) {
      return NextResponse.json({ error: 'Tipe master data tidak dikenal.' }, { status: 400 });
    }
    const body = await req.json();
    const parsed = wineMasterDataCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const result = await createWineMasterDataItem({
      type,
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      performedBy: guard.user.id,
    });
    if (result.duplicate) {
      // Normalized-name collision: return the existing record so the UI can offer it instead of
      // creating a second spelling of the same producer.
      return NextResponse.json(
        {
          error: `"${result.duplicate.name}" sudah terdaftar dengan nama yang sama (mengabaikan huruf besar/kecil dan aksen).`,
          duplicate: result.duplicate,
        },
        { status: 409 },
      );
    }
    if (!result.item) {
      return NextResponse.json({ error: 'Nama tidak valid.' }, { status: 400 });
    }
    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch (err) {
    console.error(`[POST /api/wine-master-data/${params.type}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
