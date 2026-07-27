import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { upsertMasterItems, type MasterItemUpsertInput } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CODE_PREFIX_TO_GROUP: Record<string, string> = {
  ROM: 'IBR', BIS: 'IBR', MIL: 'IBR',
  UNI: 'UNION', TUG: 'UNION',
  CNS: 'CNS', BLC: 'CNS',
  LWY: 'FRENCH', BCH: 'FRENCH', PIE: 'FRENCH',
};

function deriveOutletGroup(code: string): string | null {
  if (!code || code.length < 3) return null;
  return CODE_PREFIX_TO_GROUP[code.substring(0, 3).toUpperCase()] ?? null;
}

function parseBool(v: string | undefined): boolean {
  if (!v) return true;
  const s = String(v).trim().toLowerCase();
  return s !== '0' && s !== 'false' && s !== 'no' && s !== '';
}

function parseSemiList(v: string): string | null {
  const parts = v.split(';').map(s => s.trim()).filter(s => s !== '');
  return parts.length > 0 ? parts.join(';') : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ error: 'Please upload a .csv file.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    // Decode as UTF-8 text and strip BOM so XLSX sees clean text with an
    // explicit comma separator - prevents XLSX auto-detecting ';' as the
    // delimiter when PriceLevels or Outlets cells contain many semicolons.
    const rawText = Buffer.from(arrayBuffer).toString('utf-8').replace(/^﻿/, '');

    let rows: Record<string, string>[];
    try {
      const wb = XLSX.read(rawText, { type: 'string', FS: ',' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false, defval: '' });
    } catch {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }

    // --- DIAGNOSTIC (remove after confirmed) ---
    for (let di = 0; di < Math.min(3, rows.length); di++) {
      const r = rows[di];
      console.log(`[IMPORT DIAG] row ${di + 1} keys:`, JSON.stringify(Object.keys(r)));
      console.log(`[IMPORT DIAG] row ${di + 1} Code=${JSON.stringify(r['Code'] ?? r['code'])} Name=${JSON.stringify(r['Name'] ?? r['name'])}`);
    }
    // --- END DIAGNOSTIC ---

    const validItems: MasterItemUpsertInput[] = [];
    let skipped = 0;

    for (const row of rows) {
      const code = (row['Code'] ?? row['code'] ?? '').trim();
      const name = (row['Name'] ?? row['name'] ?? '').trim();
      if (!code || !name) {
        console.log('[IMPORT DIAG] SKIP: code=', JSON.stringify(code), 'name=', JSON.stringify(name), 'keys:', JSON.stringify(Object.keys(row).slice(0, 4)));
        skipped++;
        continue;
      }

      const priceStr = (row['Price'] ?? row['price'] ?? '').trim();
      const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.-]/g, '')) : null;

      validItems.push({
        active: parseBool(row['Active'] ?? row['active'] ?? '1'),
        code,
        name,
        category: (row['Category'] ?? row['category'] ?? '').trim(),
        department: (row['Department'] ?? row['department'] ?? '').trim(),
        salesDef: (row['SalesDef'] ?? row['salesDef'] ?? 'SALES').trim() || 'SALES',
        price: isNaN(price as number) ? null : price,
        plu: (row['PLU'] ?? row['plu'] ?? '').trim() || null,
        barcode: (row['Barcode'] ?? row['barcode'] ?? '').trim() || null,
        uom: (row['UOM'] ?? row['uom'] ?? '').trim() || null,
        folder: (row['Folder'] ?? row['folder'] ?? '').trim() || null,
        serviceCharge: parseBool(row['ServiceCharge'] ?? row['serviceCharge'] ?? '1'),
        tax1: parseBool(row['Tax1'] ?? row['tax1'] ?? '1'),
        tax2: parseBool(row['Tax2'] ?? row['tax2'] ?? '1'),
        noDiscount: parseBool(row['NoDiscount'] ?? row['noDiscount'] ?? '1'),
        hideReceipt: parseBool(row['HideReceipt'] ?? row['hideReceipt'] ?? '0'),
        printers: parseSemiList(row['Printers'] ?? row['printers'] ?? ''),
        outlets: parseSemiList(row['Outlets'] ?? row['outlets'] ?? ''),
        outletGroup: deriveOutletGroup(code),
        priceLevels: (row['PriceLevels'] ?? row['priceLevels'] ?? row['Price Levels'] ?? '').trim() || null,
      });
    }

    const result = await upsertMasterItems(validItems);

    return NextResponse.json({
      inserted: result.inserted,
      updated: result.updated,
      skipped: skipped + result.skipped,
    });
  } catch (err) {
    console.error('[POST /api/admin/kb/items/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
