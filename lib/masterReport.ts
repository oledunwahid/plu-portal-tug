// Builder for the "Master All Item" report — mirrors the structure of the
// uploaded MASTER_ALL_ITEM template: one "ALL ITEM" sheet plus one sheet per
// outlet. Pure functions only (no xlsx dependency) so the result can be fed to
// XLSX.utils.aoa_to_sheet on the frontend and unit-tested in isolation.

export interface ReportItem {
  active: boolean;
  code: string;
  name: string;
  category: string;
  department: string;
  salesDef: string;
  price: number | null;
  plu: string | null;
  barcode: string | null;
  uom: string | null;
  folder: string | null;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  printers: string | null;
  outlets: string | null;
  priceLevels: string | null;
}

// Outlet order is shared by the ALL ITEM column pairs and the per-outlet sheets.
export const REPORT_OUTLETS = [
  'BAB-SEN', 'BISSCBD', 'BLCS', 'CSSG', 'CSPI', 'CSPP', 'MILGI', 'UPIM', 'LWY-OAK',
  'UTP', 'USMS', 'UPS', 'UPIK', 'UPKW', 'UMPI', 'ROMPIM', 'ROMSCBD', 'IND1', 'PIE-SNPT',
  'MILBISPIK',
] as const;

const BASE_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef', 'Price', 'PLU',
  'Barcode', 'UOM', 'Folder', 'ServiceCharge', 'Tax1', 'Tax2', 'NoDiscount',
  'HideReceipt', 'Printers', 'Outlets', 'PriceLevels',
];

export interface PriceLevelEntry {
  salesType: string;
  outlets: string[];
  price: number | null;
}

/** Parse "DINE IN:CSPI+CSPI-B:1100000;TAKE AWAY:CSPI:1100000;..." into entries. */
export function parsePriceLevels(raw: string | null): PriceLevelEntry[] {
  if (!raw) return [];
  const out: PriceLevelEntry[] = [];
  for (const part of raw.split(';')) {
    const seg = part.trim();
    if (!seg) continue;
    const bits = seg.split(':');
    if (bits.length < 3) continue;
    const salesType = bits[0].trim();
    const outlets = bits[1].split('+').map((o) => o.trim()).filter(Boolean);
    const priceNum = parseFloat(bits[2].replace(/[^0-9.-]/g, ''));
    out.push({ salesType, outlets, price: Number.isFinite(priceNum) ? priceNum : null });
  }
  return out;
}

function splitOutlets(field: string | null): string[] {
  return (field ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

function b(v: boolean): number { return v ? 1 : 0; }

/** The outlet's price for an item: from a matching DINE IN price level, else any
 *  matching price level, else the base sell price. */
function outletPrice(item: ReportItem, outlet: string): number | null {
  const entries = parsePriceLevels(item.priceLevels).filter((e) => e.outlets.includes(outlet));
  if (entries.length > 0) {
    const dineIn = entries.find((e) => e.salesType.toUpperCase().includes('DINE'));
    return (dineIn ?? entries[0]).price ?? item.price;
  }
  return item.price;
}

/** Build the "ALL ITEM" sheet as an array-of-arrays (first row = headers). */
export function buildAllItemAoa(items: ReportItem[]): (string | number)[][] {
  const headers: string[] = [...BASE_HEADERS];
  for (const o of REPORT_OUTLETS) { headers.push(`${o} Code`, `${o} Price`); }

  const rows: (string | number)[][] = [headers];
  for (const it of items) {
    const itemOutlets = splitOutlets(it.outlets);
    const row: (string | number)[] = [
      b(it.active), it.code, it.name, it.category, it.department, it.salesDef ?? '',
      it.price ?? '', it.plu ?? '', it.barcode ?? '', it.uom ?? '', it.folder ?? '',
      b(it.serviceCharge), b(it.tax1), b(it.tax2), b(it.noDiscount), b(it.hideReceipt),
      it.printers ?? '', it.outlets ?? '', it.priceLevels ?? '',
    ];
    for (const o of REPORT_OUTLETS) {
      const inOutlet = itemOutlets.includes(o);
      if (inOutlet) {
        row.push(it.code);
        const p = outletPrice(it, o);
        row.push(p ?? '');
      } else {
        row.push(`TIDAK ADA DI ${o}`);
        row.push('');
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Build one per-outlet sheet as an array-of-arrays (first row = headers). */
export function buildOutletSheetAoa(items: ReportItem[], outlet: string): (string | number)[][] {
  const rows: (string | number)[][] = [['ItemCode', 'SalesType', 'Outlets', 'Price']];
  for (const it of items) {
    const entries = parsePriceLevels(it.priceLevels).filter((e) => e.outlets.includes(outlet));
    if (entries.length > 0) {
      for (const e of entries) {
        rows.push([it.code, e.salesType, e.outlets.join('+'), e.price ?? '']);
      }
    } else if (splitOutlets(it.outlets).includes(outlet)) {
      rows.push([it.code, 'DINE IN', (it.outlets ?? ''), it.price ?? '']);
    }
  }
  return rows;
}

export interface MasterReport {
  allItem: (string | number)[][];
  outletSheets: { name: string; aoa: (string | number)[][] }[];
}

export function buildMasterReport(items: ReportItem[]): MasterReport {
  return {
    allItem: buildAllItemAoa(items),
    outletSheets: REPORT_OUTLETS.map((o) => ({ name: o, aoa: buildOutletSheetAoa(items, o) })),
  };
}
