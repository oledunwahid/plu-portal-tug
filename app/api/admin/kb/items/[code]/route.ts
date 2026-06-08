import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMasterItemByCode, updateMasterItem, deleteMasterItem, type MasterItemUpdateInput } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const item = await getMasterItemByCode(decodeURIComponent(params.code));
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    console.error('[GET /api/admin/kb/items/[code]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const existing = await getMasterItemByCode(decodeURIComponent(params.code));
    if (!existing) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
    const body = await req.json();
    if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json({ error: 'Nama item harus diisi' }, { status: 400 });
    }
    const fields: MasterItemUpdateInput = {};
    if ('active' in body) fields.active = Boolean(body.active);
    if ('name' in body) fields.name = String(body.name).trim();
    if ('category' in body) fields.category = String(body.category ?? '');
    if ('department' in body) fields.department = String(body.department ?? '');
    if ('salesDef' in body) fields.salesDef = body.salesDef === 'MODIFIER' ? 'MODIFIER' : 'SALES';
    if ('price' in body) {
      if (body.price === '' || body.price == null) fields.price = null;
      else { const n = Number(body.price); fields.price = Number.isFinite(n) ? n : null; }
    }
    if ('plu' in body) fields.plu = body.plu ? String(body.plu) : null;
    if ('barcode' in body) fields.barcode = body.barcode ? String(body.barcode) : null;
    if ('uom' in body) fields.uom = body.uom ? String(body.uom) : null;
    if ('folder' in body) fields.folder = body.folder ? String(body.folder) : null;
    if ('serviceCharge' in body) fields.serviceCharge = Boolean(body.serviceCharge);
    if ('tax1' in body) fields.tax1 = Boolean(body.tax1);
    if ('tax2' in body) fields.tax2 = Boolean(body.tax2);
    if ('noDiscount' in body) fields.noDiscount = Boolean(body.noDiscount);
    if ('hideReceipt' in body) fields.hideReceipt = Boolean(body.hideReceipt);
    if ('printers' in body) fields.printers = body.printers ? String(body.printers) : null;
    if ('outlets' in body) fields.outlets = body.outlets ? String(body.outlets) : null;
    if ('outletGroup' in body) fields.outletGroup = body.outletGroup ? String(body.outletGroup) : null;
    const updated = await updateMasterItem(existing.id, fields);
    if (!updated) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/admin/kb/items/[code]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const existing = await getMasterItemByCode(decodeURIComponent(params.code));
    if (!existing) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
    const ok = await deleteMasterItem(existing.id);
    if (!ok) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/admin/kb/items/[code]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
