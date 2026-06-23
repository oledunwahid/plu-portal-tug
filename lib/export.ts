import * as XLSX from 'xlsx';
import type { DbMasterItem } from '@/lib/db';

// ── Unified 19-column export ────────────────────────────────────────────────
// Every admin export — regardless of request type — emits this exact column set, in this order.
// The cashier only fills a short form; the export is responsible for completing the rest, either
// from the request itself (NEW_ITEM) or from the master item record looked up by PLU code
// (UPDATE_PRICE / UPDATE_NAME / UPDATE_PRINTER / REMOVE_PLU).
//
// PriceLevels (col 19) is always present even when blank. Sourcing differs by type: NEW_ITEM
// pre-populates it from the request's cork outlets at the requested price (no master record exists
// yet); every master-sourced type emits the master's raw PriceLevels verbatim — unless the admin
// stored an explicit override during review (see TemplateSource.priceLevelsOverride).
const TEMPLATE_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef', 'Price', 'PLU', 'Barcode', 'UOM',
  'Folder', 'ServiceCharge', 'Tax1', 'Tax2', 'NoDiscount', 'HideReceipt', 'Printers', 'Outlets',
  'PriceLevels',
] as const;

export interface TemplateRow {
  Active: number;
  Code: string; Name: string; Category: string; Department: string; SalesDef: string;
  Price: number | string; PLU: string; Barcode: string; UOM: string; Folder: string;
  ServiceCharge: number; Tax1: number; Tax2: number; NoDiscount: number; HideReceipt: number;
  Printers: string; Outlets: string; PriceLevels: string;
}

// Outlets in the CNS "cork" set get a DINE IN + TAKE AWAY price-level entry pre-populated on
// NEW_ITEM exports (BLCS, the seventh CNS outlet, is intentionally excluded). All other outlets
// contribute no price-level entry.
const CORK_OUTLETS = new Set(['CSPP', 'CSPI', 'CSSG', 'CSPP-B', 'CSPI-B', 'CSSG-B']);

// Build the NEW_ITEM PriceLevels string. For each cork outlet listed in the request's Outlets field,
// emit a DINE IN and a TAKE AWAY entry at the requested price, in the existing
// OutletType:OutletGroup:Price ; … convention. Non-cork outlets contribute nothing; the result is
// blank when no cork outlets are selected (matching the "blank, never omitted" column rule).
function newItemPriceLevels(outlets: string, price: number | null): string {
  const cork = outlets.split(/[;,]/).map((o) => o.trim()).filter((o) => CORK_OUTLETS.has(o));
  if (cork.length === 0) return '';
  const priceStr = price ?? '';
  const entries: string[] = [];
  for (const o of cork) {
    entries.push(`DINE IN:${o}:${priceStr}`);
    entries.push(`TAKE AWAY:${o}:${priceStr}`);
  }
  return entries.join(';');
}

// Blank only when the source genuinely has no value for the field; booleans default to 0/1.
const str = (v: string | null | undefined): string => v ?? '';
const flag = (v: boolean | null | undefined): number => (v ? 1 : 0);

// The minimal shape every request/batch-item row provides. DbPLURequest and DbRequestBatchItem
// both satisfy this, so a single dispatcher can build rows for single and batch exports alike.
export interface TemplateSource {
  code: string | null;
  name: string; category: string; department: string;
  price: number | null; folder: string | null;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
  printers: string; outlets: string; salesDef: string; barcode: string | null;
  // Set only when the admin explicitly edited PriceLevels for this request during review/approval.
  // When present (even as ''), it overrides the master's verbatim PriceLevels on master-sourced
  // exports; when undefined, the master value is used as-is. No request type recomputes this —
  // recompute is the Price Check feature's job, not the export's. NOTE: no DB column currently backs
  // this field, so it is always undefined today (see findings) — kept optional for forward-compat.
  priceLevelsOverride?: string | null;
}

// Build the full 18-col row from the master record (looked up by the request's stored PLU code).
// Code falls back to the request code so an unmatched row is still identifiable; the route flags
// such rows via buildMissingMasterWarning() so the admin knows the master-sourced columns are blank.
// PriceLevels is master-verbatim by default; an explicit admin override (when stored on the request)
// wins, including a deliberately-blank ''. undefined override → fall back to master.
function masterRow(
  reqCode: string | null, m: DbMasterItem | undefined, priceLevelsOverride?: string | null,
): TemplateRow {
  return {
    Active: flag(m?.active), Code: m?.code ?? str(reqCode), Name: str(m?.name),
    Category: str(m?.category), Department: str(m?.department), SalesDef: str(m?.salesDef),
    Price: m?.price ?? '', PLU: str(m?.plu), Barcode: str(m?.barcode), UOM: str(m?.uom),
    Folder: str(m?.folder), ServiceCharge: flag(m?.serviceCharge), Tax1: flag(m?.tax1),
    Tax2: flag(m?.tax2), NoDiscount: flag(m?.noDiscount), HideReceipt: flag(m?.hideReceipt),
    Printers: str(m?.printers), Outlets: str(m?.outlets),
    PriceLevels: priceLevelsOverride != null ? priceLevelsOverride : str(m?.priceLevels),
  };
}

// NEW_ITEM: the item does not exist in master yet, so everything comes from the request.
// Active is hardcoded 1; PLU and UOM are always blank (kept as columns); SalesDef defaults to
// SALES unless the request explicitly says MODIFIER; booleans reflect the submitted values.
export function newItemToTemplateRow(r: TemplateSource): TemplateRow {
  return {
    Active: 1, Code: str(r.code), Name: r.name, Category: r.category, Department: r.department,
    SalesDef: r.salesDef === 'MODIFIER' ? 'MODIFIER' : 'SALES', Price: r.price ?? '',
    PLU: '', Barcode: str(r.barcode), UOM: '', Folder: str(r.folder),
    ServiceCharge: flag(r.serviceCharge), Tax1: flag(r.tax1), Tax2: flag(r.tax2),
    NoDiscount: flag(r.noDiscount), HideReceipt: flag(r.hideReceipt),
    Printers: r.printers, Outlets: r.outlets,
    PriceLevels: newItemPriceLevels(r.outlets, r.price),
  };
}

// UPDATE_PRICE: every column from master, Price overridden with the approved new price. PriceLevels
// stays master-verbatim (or the admin's stored override) — never auto-recomputed from the new price.
export function priceToTemplateRow(
  reqCode: string | null, m: DbMasterItem | undefined, newPrice: number | null,
  priceLevelsOverride?: string | null,
): TemplateRow {
  return { ...masterRow(reqCode, m, priceLevelsOverride), Price: newPrice ?? '' };
}

// UPDATE_NAME: every column from master, Name overridden with the requested new name.
export function nameToTemplateRow(
  reqCode: string | null, m: DbMasterItem | undefined, newName: string,
  priceLevelsOverride?: string | null,
): TemplateRow {
  return { ...masterRow(reqCode, m, priceLevelsOverride), Name: newName };
}

// UPDATE_PRINTER: every column from master, Printers overridden with the requested routing.
export function printerToTemplateRow(
  reqCode: string | null, m: DbMasterItem | undefined, newPrinters: string,
  priceLevelsOverride?: string | null,
): TemplateRow {
  return { ...masterRow(reqCode, m, priceLevelsOverride), Printers: newPrinters };
}

// REMOVE_PLU (delete): every column from master verbatim — a record of what existed — except
// Active, forced to 0 to signal deactivation regardless of the master value.
export function deleteToTemplateRow(
  reqCode: string | null, m: DbMasterItem | undefined, priceLevelsOverride?: string | null,
): TemplateRow {
  return { ...masterRow(reqCode, m, priceLevelsOverride), Active: 0 };
}

// Dispatch a single request/batch-item row to the right mapper based on its request type.
// NEW_ITEM ignores the master entirely; every other type reads from it (overriding one column).
export function requestToTemplateRow(
  requestType: string, r: TemplateSource, m: DbMasterItem | undefined,
): TemplateRow {
  switch (requestType) {
    case 'NEW_ITEM':       return newItemToTemplateRow(r);
    case 'UPDATE_PRICE':   return priceToTemplateRow(r.code, m, r.price, r.priceLevelsOverride);
    case 'UPDATE_NAME':    return nameToTemplateRow(r.code, m, r.name, r.priceLevelsOverride);
    case 'UPDATE_PRINTER': return printerToTemplateRow(r.code, m, r.printers, r.priceLevelsOverride);
    case 'REMOVE_PLU':     return deleteToTemplateRow(r.code, m, r.priceLevelsOverride);
    // Unknown/mixed without a resolvable type — fall back to request data so nothing is dropped.
    default:               return newItemToTemplateRow(r);
  }
}

// True for every type whose columns are sourced from master (so a missing master row matters).
// NEW_ITEM is request-sourced and must never be flagged as "missing master".
export function isMasterSourced(requestType: string): boolean {
  return requestType !== 'NEW_ITEM';
}

export function generateTemplateXLSX(rows: TemplateRow[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_HEADERS] });
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 15 }));
  ws['!cols'][2] = { wch: 30 }; // Name column wider
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export function generateTemplateCSV(rows: TemplateRow[]): string {
  const body = rows.map((r) => TEMPLATE_HEADERS.map((h) => {
    const v = r[h];
    return v == null ? '' : String(v);
  }));
  return [TEMPLATE_HEADERS.join(','), ...body.map((row) => row.map(escapeCsv).join(','))].join('\n');
}

/**
 * Identify export rows whose PLU code has no matching master item — those rows export with the
 * master-sourced template columns left blank. Logs a server-side warning and returns an encoded
 * value for the `X-Export-Warnings` response header so the admin sees which rows are incomplete
 * before the file is saved. Returns null when every row resolved cleanly.
 *
 * Only pass master-sourced rows here (UPDATE_* / REMOVE_PLU); NEW_ITEM rows are request-sourced and
 * legitimately have no master record yet.
 */
export function buildMissingMasterWarning(
  requests: { code: string | null; name: string }[],
  masterMap: Map<string, unknown>,
  logPrefix: string,
): string | null {
  const missing = requests.filter((r) => !(r.code && masterMap.has(r.code)));
  if (missing.length === 0) return null;

  console.warn(
    `${logPrefix} export: ${missing.length} row(s) without a master item match ` +
    `(master-sourced columns left blank): ${missing.map((r) => r.code ?? '(no code)').join(', ')}`,
  );

  const payload = {
    type: 'MISSING_MASTER',
    count: missing.length,
    rows: missing.slice(0, 50).map((r) => ({ code: r.code ?? '', name: r.name })),
  };
  // encodeURIComponent keeps the header value ASCII-safe (item names may contain non-Latin chars).
  return encodeURIComponent(JSON.stringify(payload));
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
