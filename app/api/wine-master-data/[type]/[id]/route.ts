import { NextRequest, NextResponse } from 'next/server';
import { requireWinePermission } from '@/lib/wineApi';
import { wineMasterDataUpdateSchema } from '@/lib/validations';
import { isWineMasterDataType } from '@/lib/wine';
import { getWineMasterDataById, updateWineMasterDataItem } from '@/lib/wineDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  const guard = await requireWinePermission('WINE_LIST_MANAGE_MASTER_DATA');
  if ('response' in guard) return guard.response;

  try {
    const type = params.type.toUpperCase();
    if (!isWineMasterDataType(type)) {
      return NextResponse.json({ error: 'Tipe master data tidak dikenal.' }, { status: 400 });
    }
    const existing = await getWineMasterDataById(params.id);
    if (!existing) return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
    // The type is part of the record's identity, so a mismatched URL is a client bug, not a rename.
    if (existing.type !== type) {
      return NextResponse.json({ error: 'Tipe master data tidak sesuai.' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = wineMasterDataUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const result = await updateWineMasterDataItem(params.id, {
      ...parsed.data,
      performedBy: guard.user.id,
    });
    if (result.duplicate) {
      return NextResponse.json(
        {
          error: `"${result.duplicate.name}" sudah terdaftar dengan nama yang sama.`,
          duplicate: result.duplicate,
        },
        { status: 409 },
      );
    }
    if (!result.item) return NextResponse.json({ error: 'Nama tidak valid.' }, { status: 400 });
    return NextResponse.json({ item: result.item });
  } catch (err) {
    console.error(`[PATCH /api/wine-master-data/${params.type}/${params.id}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
