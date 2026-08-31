// Long-form price-levels sheet: the 4-column template admins export, edit in Excel,
// and re-import to rewrite MasterItem.priceLevels without touching any other column.
//
// STORAGE FORMAT (unchanged by this module):
//   "SalesType:Outlets:Price;SalesType:Outlets:Price"
//   - ';' separates ENTRIES. Each entry carries its own SalesType and Price.
//   - '+' separates OUTLETS *within* one entry.
//
// SHEET FORMAT: one row per entry, so the two delimiters never collide in a cell:
//   ItemCode | SalesType | Outlets | Price
//   TUG505…  | DINE IN   | CSPP+CSPP-B | 8600000
//   TUG505…  | TAKE AWAY | CSPP+CSPP-B | 8600000
//
// A stored value like "DINE IN:CSPI+CSPI-B:1100000;DINE IN:CSSG+CSSG-B:1100000" is therefore
// TWO rows, not one cell containing ';' - splitting it any other way would make the Outlets
// column ambiguous and break CSV round-tripping.
//
// Parsing is delegated to lib/masterReport.ts (the parser whose output is already
// { salesType, outlets[], price }); this module owns only the sheet<->string bridge.

import * as XLSX from 'xlsx';
import { parsePriceLevels, type PriceLevelEntry } from './masterReport';

export const PRICE_LEVEL_SHEET_HEADERS = ['ItemCode', 'SalesType', 'Outlets', 'Price'] as const;

// Quinos only emits these two. Compared case-sensitively on purpose: a lowercased or
// abbreviated value ("Dine In", "DINE") is a transcription slip, and silently accepting it
// would write a string the POS does not recognise.
export const VALID_SALES_TYPES = ['DINE IN', 'TAKE AWAY'] as const;

export interface PriceLevelSheetRow {
  itemCode: string;
  salesType: string;
  outlets: string;
  price: number | null;
}

/** One sheet row per parsed entry. Outlets rejoined with '+' - see the delimiter note above. */
export function itemToSheetRows(code: string, priceLevels: string | null): PriceLevelSheetRow[] {
  return parsePriceLevels(priceLevels).map((e: PriceLevelEntry) => ({
    itemCode: code,
    salesType: e.salesType,
    // An entry with a genuinely empty outlets field (Quinos exports carry a few) round-trips
    // as an empty cell rather than being dropped.
    outlets: e.outlets.join('+'),
    price: e.price,
  }));
}

/** Serialize sheet rows for ONE item back into the stored Quinos string. */
export function serializeSheetRows(rows: PriceLevelSheetRow[]): string {
  return rows
    .map((r) => `${r.salesType}:${r.outlets}:${r.price ?? ''}`)
    .join(';');
}

export interface SheetRowError {
  row: number;          // 1-based spreadsheet row number, header included
  itemCode: string;
  field: 'ItemCode' | 'SalesType' | 'Outlets' | 'Price';
  message: string;
}

export interface ValidationResult {
  rows: PriceLevelSheetRow[];
  errors: SheetRowError[];
}

// Accepts "8.550.000", "8,550,000" and "8550000" alike - admins edit these cells in Excel with
// Indonesian locale formatting, and a thousands separator is not a data error.
function parseSheetPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/[.,](?=\d{3}\b)/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate raw sheet records. `allowedCodes` is the set of item codes in scope (present in the
 * batch AND in master) - a row naming anything else is rejected rather than silently applied to
 * an item the admin was not looking at.
 *
 * Every row is checked; errors accumulate so one bad cell does not hide the rest.
 */
export function validateSheetRows(
  records: Record<string, unknown>[],
  allowedCodes: Set<string>,
): ValidationResult {
  const rows: PriceLevelSheetRow[] = [];
  const errors: SheetRowError[] = [];

  records.forEach((rec, i) => {
    // +2: one for the header row, one to make it 1-based like Excel's row numbers.
    const rowNum = i + 2;
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const v = rec[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    const itemCode = pick('ItemCode', 'itemCode', 'Item Code', 'Code', 'code');
    const salesType = pick('SalesType', 'salesType', 'Sales Type');
    // Outlets may legitimately be blank, so it is read directly rather than via pick().
    const outletsRaw = rec['Outlets'] ?? rec['outlets'] ?? '';
    const outlets = String(outletsRaw ?? '').trim();
    const priceRaw = pick('Price', 'price');

    // A row with nothing in it is trailing spreadsheet noise, not an error.
    if (!itemCode && !salesType && !outlets && !priceRaw) return;

    let rowOk = true;

    if (!itemCode) {
      errors.push({ row: rowNum, itemCode: '', field: 'ItemCode', message: 'ItemCode is required.' });
      rowOk = false;
    } else if (!allowedCodes.has(itemCode)) {
      errors.push({
        row: rowNum, itemCode, field: 'ItemCode',
        message: 'Not a master item in this batch.',
      });
      rowOk = false;
    }

    if (!VALID_SALES_TYPES.includes(salesType as typeof VALID_SALES_TYPES[number])) {
      errors.push({
        row: rowNum, itemCode, field: 'SalesType',
        message: `Invalid value: ${salesType || '(empty)'}. Expected DINE IN or TAKE AWAY.`,
      });
      rowOk = false;
    }

    // ':' and ';' would corrupt the stored string on the way back in - the outlet field sits
    // between both delimiters, so a stray one silently reshapes every entry after it.
    if (outlets.includes(':') || outlets.includes(';')) {
      errors.push({
        row: rowNum, itemCode, field: 'Outlets',
        message: 'Outlets cannot contain ":" or ";". Separate outlets with "+".',
      });
      rowOk = false;
    }

    const price = parseSheetPrice(priceRaw);
    if (price === null) {
      errors.push({
        row: rowNum, itemCode, field: 'Price',
        message: `Not a number: ${priceRaw || '(empty)'}.`,
      });
      rowOk = false;
    } else if (price < 0) {
      errors.push({ row: rowNum, itemCode, field: 'Price', message: 'Price cannot be negative.' });
      rowOk = false;
    }

    if (rowOk) rows.push({ itemCode, salesType, outlets, price });
  });

  return { rows, errors };
}

/**
 * Group validated rows by item and rebuild each item's stored string.
 * Sheet order is preserved: the admin's row order becomes the entry order.
 */
export function buildPriceLevelUpdates(rows: PriceLevelSheetRow[]): Map<string, string> {
  const byCode = new Map<string, PriceLevelSheetRow[]>();
  for (const r of rows) {
    const list = byCode.get(r.itemCode);
    if (list) list.push(r); else byCode.set(r.itemCode, [r]);
  }
  const out = new Map<string, string>();
  byCode.forEach((list, code) => out.set(code, serializeSheetRows(list)));
  return out;
}

// ── Sheet reading ───────────────────────────────────────────────────────────

/**
 * Guess a CSV's separator from its header line instead of letting SheetJS decide.
 * The master-items upload route pins ',' outright because SheetJS's detection misfires on
 * semicolon-heavy cells; here the sheet may legitimately arrive either way (Excel in an
 * en-US locale writes ',', a locale using ';' as its list separator writes ';'), so the
 * header - which contains no data delimiters - is the safe place to look.
 */
export function detectDelimiter(text: string): string {
  const LF = String.fromCharCode(10);
  // .trim() also drops the CR of a CRLF file, so the count is not skewed by line endings.
  const header = (text.split(LF, 1)[0] ?? '').trim();
  return header.split(';').length > header.split(',').length ? ';' : ',';
}

/** Read the first sheet of an .xlsx/.xls/.csv buffer into raw records, or null if unreadable. */
export function readSheetRecords(
  fileName: string, buf: ArrayBuffer,
): Record<string, unknown>[] | null {
  try {
    let wb: XLSX.WorkBook;
    if (fileName.toLowerCase().endsWith('.csv')) {
      // Strip the BOM Excel writes so the first header cell is not "﻿ItemCode".
      const text = Buffer.from(buf).toString('utf-8').replace(/^﻿/, '');
      wb = XLSX.read(text, { type: 'string', FS: detectDelimiter(text) });
    } else {
      wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });
  } catch {
    return null;
  }
}

/** True when the records carry the columns the template requires. */
export function hasRequiredColumns(records: Record<string, unknown>[]): boolean {
  if (records.length === 0) return false;
  const keys = Object.keys(records[0]).map((k) => k.trim().toLowerCase());
  return ['itemcode', 'salestype', 'price'].every((r) => keys.includes(r));
}
