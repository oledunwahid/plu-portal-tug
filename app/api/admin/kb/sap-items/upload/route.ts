import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { upsertSapMasterItems, type SapMasterItemUpsertInput } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Pull a cell by any of several accepted header spellings.
function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv') || file.type === 'text/csv';
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!isCsv && !isXlsx) {
      return NextResponse.json({ error: 'Please upload a .xlsx or .csv file.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let rows: Record<string, string>[];
    try {
      let wb: XLSX.WorkBook;
      if (isCsv) {
        // Decode as UTF-8, strip BOM, force comma delimiter so SAP barcode cells
        // are read literally.
        const text = Buffer.from(arrayBuffer).toString('utf-8').replace(/^﻿/, '');
        wb = XLSX.read(text, { type: 'string', FS: ',' });
      } else {
        wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false, defval: '' });
    } catch {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty or unreadable.' }, { status: 400 });
    }

    const ITEM_NO = ['Item No.', 'Item No', 'ItemNo', 'Item Number', 'Code'];
    const DESC = ['Item Description', 'Description', 'Item Desc', 'Name'];
    const SUBGROUP = ['Sub Group', 'SubGroup', 'Subgroup', 'Group'];
    const BARCODE = ['Bar Code', 'BarCode', 'Barcode', 'Bar code'];

    const valid: SapMasterItemUpsertInput[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const row of rows) {
      const itemNo = pick(row, ITEM_NO);
      const description = pick(row, DESC);
      if (!itemNo || !description) { skipped++; continue; }
      // De-dupe within the file so the last occurrence wins predictably.
      if (seen.has(itemNo)) {
        const idx = valid.findIndex((v) => v.itemNo === itemNo);
        if (idx >= 0) valid.splice(idx, 1);
      }
      seen.add(itemNo);
      valid.push({
        itemNo,
        description,
        subGroup: pick(row, SUBGROUP) || null,
        barcode: pick(row, BARCODE) || null,
      });
    }

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Expected columns: Item No., Item Description, Sub Group, Bar Code.' }, { status: 400 });
    }

    const result = await upsertSapMasterItems(valid);
    return NextResponse.json({
      inserted: result.inserted,
      updated: result.updated,
      skipped: skipped + result.skipped,
    });
  } catch (err) {
    console.error('[POST /api/admin/kb/sap-items/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
