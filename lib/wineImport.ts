/**
 * Legacy Wine List import - pure parsing, mapping and validation. No DB access, so the whole
 * pipeline is deterministic and the preview a user approves is exactly what execute will do.
 *
 * The legacy app exports (roughly): Status, Code, Wine Name, Producer, Appellation, Vintage,
 * Cost per Bottle, Bottle Size, Varietal, Type, Category, Sub Category 1, Sub Category 2.
 *
 * IMPORTANT: the legacy `Code` is NOT a PLU code. It is kept as `legacyWineCode` and never treated
 * as a Quinos code. Matching to a Master Item goes through barcode, then PLU code, then name - and a
 * row that matches nothing is reported as UNMATCHED. The import never creates a Master Item.
 */

import { parseVintage, parseWineNumber, normalizeWineText } from './wine';

/** Wine fields an import row can carry. `pluCode` / `barcode` are optional match keys. */
export const WINE_IMPORT_FIELDS = [
  'status',
  'legacyCode',
  'wineName',
  'producer',
  'country',
  'region',
  'appellation',
  'classification',
  'vintage',
  'costPerBottle',
  'bottleSize',
  'varietal',
  'wineType',
  'category',
  'subCategory1',
  'subCategory2',
  'abv',
  'pluCode',
  'barcode',
] as const;

export type WineImportField = (typeof WINE_IMPORT_FIELDS)[number];

export const WINE_IMPORT_FIELD_LABELS: Record<WineImportField, string> = {
  status: 'Status',
  legacyCode: 'Code (legacy)',
  wineName: 'Wine Name',
  producer: 'Producer',
  country: 'Country',
  region: 'Region',
  appellation: 'Appellation',
  classification: 'Classification',
  vintage: 'Vintage',
  costPerBottle: 'Cost per Bottle',
  bottleSize: 'Bottle Size',
  varietal: 'Varietal',
  wineType: 'Type',
  category: 'Category',
  subCategory1: 'Sub Category 1',
  subCategory2: 'Sub Category 2',
  abv: 'ABV',
  pluCode: 'PLU Code',
  barcode: 'Barcode',
};

/** Only these must be present for a row to be importable at all. */
export const WINE_IMPORT_REQUIRED_FIELDS: WineImportField[] = ['wineName'];

/**
 * Header aliases used to auto-suggest a column mapping. Compared on normalized text, so
 * "COST PER BOTTLE", "Cost/Bottle" and "cost per bottle" all land on the same field.
 */
const HEADER_ALIASES: Record<WineImportField, string[]> = {
  status: ['status', 'active', 'aktif'],
  legacyCode: ['code', 'wine code', 'kode', 'legacy code', 'old code', 'item code'],
  wineName: ['wine name', 'name', 'wine', 'nama wine', 'item name', 'description'],
  producer: ['producer', 'winery', 'produsen', 'brand', 'maker'],
  country: ['country', 'negara', 'origin'],
  region: ['region', 'wilayah', 'area'],
  appellation: ['appellation', 'appelation', 'aoc', 'doc', 'sub region'],
  classification: ['classification', 'class', 'grade', 'klasifikasi'],
  vintage: ['vintage', 'year', 'tahun'],
  costPerBottle: ['cost per bottle', 'cost bottle', 'cost', 'harga beli', 'hpp', 'cost btl'],
  bottleSize: ['bottle size', 'size', 'volume', 'ukuran', 'btl size', 'format'],
  varietal: ['varietal', 'varietals', 'grape', 'grapes', 'grape variety', 'variety'],
  wineType: ['type', 'wine type', 'jenis', 'colour', 'color'],
  category: ['category', 'kategori', 'cat'],
  subCategory1: ['sub category 1', 'sub category1', 'subcategory 1', 'sub cat 1', 'sub category'],
  subCategory2: ['sub category 2', 'sub category2', 'subcategory 2', 'sub cat 2'],
  abv: ['abv', 'alcohol', 'alc', 'alkohol'],
  pluCode: ['plu code', 'plu', 'quinos code', 'pos code'],
  barcode: ['barcode', 'bar code', 'ean', 'sap item no', 'item no'],
};

export type WineColumnMapping = Partial<Record<WineImportField, string>>;

/**
 * Best-effort mapping from spreadsheet headers to wine fields. The user always sees and can correct
 * it before preview - this only saves typing on a well-formed legacy export.
 */
export function suggestColumnMapping(headers: string[]): WineColumnMapping {
  const mapping: WineColumnMapping = {};
  const taken = new Set<string>();
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeWineText(h) }));

  for (const field of WINE_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field].map((a) => normalizeWineText(a));
    // Exact alias match first, then a contains match, so "Sub Category 1" doesn't steal "Category".
    const exact = normalizedHeaders.find((h) => !taken.has(h.raw) && aliases.includes(h.norm));
    const chosen = exact
      ?? normalizedHeaders.find((h) => !taken.has(h.raw) && h.norm && aliases.some((a) => h.norm === a || h.norm.startsWith(`${a} `)));
    if (chosen) {
      mapping[field] = chosen.raw;
      taken.add(chosen.raw);
    }
  }
  return mapping;
}

export interface RawImportRow {
  /** 1-based row number as it appears in the file (header excluded), for the error report. */
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ParsedWineRow {
  rowNumber: number;
  status: 'Active' | 'Inactive';
  legacyCode: string | null;
  wineName: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  classification: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  costPerBottle: number | null;
  bottleSize: string | null;
  varietals: string[];
  wineType: string | null;
  category: string | null;
  subCategory1: string | null;
  subCategory2: string | null;
  abv: number | null;
  pluCode: string | null;
  barcode: string | null;
  /** Blocking problems - the row cannot be imported. */
  errors: { error: string; recommendation: string }[];
  /** Non-blocking notes shown in the preview. */
  warnings: string[];
}

function cell(row: RawImportRow, mapping: WineColumnMapping, field: WineImportField): string {
  const column = mapping[field];
  if (!column) return '';
  const value = row.values[column];
  if (value == null) return '';
  return String(value).trim();
}

/** Legacy varietal cells are free text: "Cabernet Sauvignon 60%, Merlot 40%" or "Syrah / Grenache". */
export function splitVarietals(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,;/|+&]| and /i)
    .map((part) => part.replace(/\d+(\.\d+)?\s*%/g, '').trim())
    .filter(Boolean);
}

export function parseWineImportRow(row: RawImportRow, mapping: WineColumnMapping): ParsedWineRow {
  const errors: { error: string; recommendation: string }[] = [];
  const warnings: string[] = [];

  const wineName = cell(row, mapping, 'wineName');
  if (!wineName) {
    errors.push({
      error: 'Wine Name kosong.',
      recommendation: 'Isi kolom Wine Name pada file sumber, atau hapus baris ini.',
    });
  }

  const rawStatus = cell(row, mapping, 'status').toUpperCase();
  const status: 'Active' | 'Inactive' =
    ['INACTIVE', 'TIDAK AKTIF', 'NONAKTIF', 'N', 'NO', '0', 'FALSE'].includes(rawStatus)
      ? 'Inactive'
      : 'Active';

  const vintageCell = cell(row, mapping, 'vintage');
  const { vintage, nonVintage } = parseVintage(vintageCell);
  const currentYear = new Date().getFullYear();
  if (vintageCell && vintage == null && !nonVintage) {
    errors.push({
      error: `Vintage "${vintageCell}" tidak valid.`,
      recommendation: 'Gunakan empat digit tahun (contoh 2018) atau NV untuk Non-Vintage.',
    });
  } else if (vintage != null && vintage > currentYear) {
    errors.push({
      error: `Vintage ${vintage} lebih besar dari tahun berjalan.`,
      recommendation: 'Perbaiki tahun pada file sumber.',
    });
  }
  if (!vintageCell) {
    // No vintage column value at all - treat as Non-Vintage rather than blocking the row, and say so.
    warnings.push('Vintage kosong - diimpor sebagai Non-Vintage.');
  }

  const abvRaw = cell(row, mapping, 'abv');
  const abv = abvRaw ? parseWineNumber(abvRaw) : null;
  if (abvRaw && (abv == null || abv < 0 || abv > 100)) {
    warnings.push(`ABV "${abvRaw}" tidak valid - diabaikan.`);
  }

  const costRaw = cell(row, mapping, 'costPerBottle');
  const costPerBottle = costRaw ? parseWineNumber(costRaw) : null;
  if (costRaw && costPerBottle == null) {
    warnings.push(`Cost per Bottle "${costRaw}" tidak dapat dibaca - diabaikan.`);
  }

  const producer = cell(row, mapping, 'producer') || null;
  if (!producer) warnings.push('Producer kosong - data wine akan berstatus Incomplete.');
  const bottleSize = cell(row, mapping, 'bottleSize') || null;
  if (!bottleSize) warnings.push('Bottle Size kosong - data wine akan berstatus Incomplete.');

  return {
    rowNumber: row.rowNumber,
    status,
    legacyCode: cell(row, mapping, 'legacyCode') || null,
    wineName,
    producer,
    country: cell(row, mapping, 'country') || null,
    region: cell(row, mapping, 'region') || null,
    appellation: cell(row, mapping, 'appellation') || null,
    classification: cell(row, mapping, 'classification') || null,
    vintage: vintage != null && vintage <= currentYear ? vintage : null,
    // Rule 11: a missing / NV / sentinel vintage becomes the flag, never a fake year.
    isNonVintage: nonVintage || !vintageCell,
    costPerBottle: costPerBottle != null && costPerBottle >= 0 ? costPerBottle : null,
    bottleSize,
    varietals: splitVarietals(cell(row, mapping, 'varietal')),
    wineType: cell(row, mapping, 'wineType') || null,
    category: cell(row, mapping, 'category') || null,
    subCategory1: cell(row, mapping, 'subCategory1') || null,
    subCategory2: cell(row, mapping, 'subCategory2') || null,
    abv: abv != null && abv >= 0 && abv <= 100 ? abv : null,
    pluCode: cell(row, mapping, 'pluCode') || null,
    barcode: cell(row, mapping, 'barcode') || null,
    errors,
    warnings,
  };
}

export type WineImportOutcome =
  | 'CREATE'
  | 'UPDATE'
  | 'UNMATCHED'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_EXISTING'
  | 'FAILED';

export interface WineImportPlanRow extends ParsedWineRow {
  outcome: WineImportOutcome;
  matchMethod: 'BARCODE' | 'PLU_CODE' | 'NAME' | 'NONE';
  masterItemId: string | null;
  masterItemCode: string | null;
  masterItemName: string | null;
  /** Existing Wine Master already on this Master Item, if any. */
  existingWineId: string | null;
  note: string | null;
}

export interface MasterLookup {
  byCode: Map<string, { id: string; code: string; name: string }>;
  byBarcode: Map<string, { id: string; code: string; name: string }[]>;
  byNormalizedName: Map<string, { id: string; code: string; name: string }[]>;
  /** masterItemId → existing ACTIVE WineMaster id. */
  activeWineByMasterId: Map<string, string>;
}

/**
 * Decide what each parsed row would do. Match cascade: exact barcode → exact PLU code → exact
 * normalized name. A name match is only accepted when it is unambiguous (one candidate), because a
 * wrong master link would attach wine data to the wrong PLU.
 *
 * Two rows pointing at the same Master Item (edge case 13): the first wins, the rest are reported as
 * DUPLICATE_IN_FILE rather than silently overwriting each other.
 */
export function planWineImport(rows: ParsedWineRow[], lookup: MasterLookup): WineImportPlanRow[] {
  const claimedMasters = new Map<string, number>();
  const out: WineImportPlanRow[] = [];

  for (const row of rows) {
    if (row.errors.length > 0) {
      out.push({
        ...row, outcome: 'FAILED', matchMethod: 'NONE', masterItemId: null,
        masterItemCode: null, masterItemName: null, existingWineId: null,
        note: row.errors[0].error,
      });
      continue;
    }

    let match: { id: string; code: string; name: string } | null = null;
    let method: WineImportPlanRow['matchMethod'] = 'NONE';

    const barcode = (row.barcode ?? '').trim().toLowerCase();
    if (barcode) {
      const candidates = lookup.byBarcode.get(barcode) ?? [];
      if (candidates.length === 1) { match = candidates[0]; method = 'BARCODE'; }
      else if (candidates.length > 1) {
        // Edge case 14: the old file's barcode is used by more than one master item.
        out.push({
          ...row, outcome: 'UNMATCHED', matchMethod: 'NONE', masterItemId: null,
          masterItemCode: null, masterItemName: null, existingWineId: null,
          note: `Barcode ${row.barcode} digunakan oleh ${candidates.length} Master Item - perlu pemetaan manual.`,
        });
        continue;
      }
    }
    if (!match && row.pluCode) {
      const byCode = lookup.byCode.get(row.pluCode.trim());
      if (byCode) { match = byCode; method = 'PLU_CODE'; }
    }
    if (!match) {
      const candidates = lookup.byNormalizedName.get(normalizeWineText(row.wineName)) ?? [];
      if (candidates.length === 1) { match = candidates[0]; method = 'NAME'; }
    }

    if (!match) {
      out.push({
        ...row, outcome: 'UNMATCHED', matchMethod: 'NONE', masterItemId: null,
        masterItemCode: null, masterItemName: null, existingWineId: null,
        note: row.legacyCode
          ? `Legacy Code ${row.legacyCode} tidak cocok dengan Master Item mana pun.`
          : 'Tidak ditemukan Master Item yang cocok.',
      });
      continue;
    }

    const claimedBy = claimedMasters.get(match.id);
    if (claimedBy != null) {
      out.push({
        ...row, outcome: 'DUPLICATE_IN_FILE', matchMethod: method, masterItemId: match.id,
        masterItemCode: match.code, masterItemName: match.name, existingWineId: null,
        note: `Master Item ${match.code} sudah dipakai oleh baris ${claimedBy} pada file ini.`,
      });
      continue;
    }

    const existingWineId = lookup.activeWineByMasterId.get(match.id) ?? null;
    claimedMasters.set(match.id, row.rowNumber);
    out.push({
      ...row,
      // An existing wine on this master item is updated in place, not duplicated (rule 2).
      outcome: existingWineId ? 'UPDATE' : 'CREATE',
      matchMethod: method,
      masterItemId: match.id,
      masterItemCode: match.code,
      masterItemName: match.name,
      existingWineId,
      note: existingWineId
        ? `Wine Master sudah ada untuk ${match.code} - data akan diperbarui.`
        : method === 'NAME'
          ? `Dicocokkan berdasarkan nama dengan ${match.code} - mohon diperiksa.`
          : null,
    });
  }

  return out;
}

export interface WineImportSummary {
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  duplicateRows: number;
  failedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
}

export function summarizeWineImport(plan: WineImportPlanRow[]): WineImportSummary {
  const count = (outcome: WineImportOutcome) => plan.filter((r) => r.outcome === outcome).length;
  const created = count('CREATE');
  const updated = count('UPDATE');
  const duplicates = count('DUPLICATE_IN_FILE') + count('DUPLICATE_EXISTING');
  const failed = count('FAILED');
  const unmatched = count('UNMATCHED');
  return {
    totalRows: plan.length,
    createdRows: created,
    updatedRows: updated,
    duplicateRows: duplicates,
    failedRows: failed,
    // Anything not created or updated is skipped by the executor.
    skippedRows: duplicates + failed + unmatched,
    matchedRows: created + updated,
    unmatchedRows: unmatched,
  };
}

/** Rows the error report should list: everything that will not be imported. */
export function importErrorRows(plan: WineImportPlanRow[]): {
  rowNumber: number; wineName: string | null; pluCode: string | null; barcode: string | null;
  error: string; recommendation: string;
}[] {
  const RECOMMENDATIONS: Record<string, string> = {
    UNMATCHED: 'Cocokkan manual ke Master Item, atau buat item melalui New Item Request terlebih dahulu.',
    DUPLICATE_IN_FILE: 'Gabungkan baris duplikat pada file sumber sebelum import ulang.',
    DUPLICATE_EXISTING: 'Periksa wine yang sudah ada; gunakan Edit Wine bila memang produk yang sama.',
  };
  return plan
    .filter((row) => row.outcome !== 'CREATE' && row.outcome !== 'UPDATE')
    .map((row) => ({
      rowNumber: row.rowNumber,
      wineName: row.wineName || null,
      pluCode: row.pluCode ?? row.masterItemCode ?? null,
      barcode: row.barcode ?? null,
      error: row.errors[0]?.error ?? row.note ?? row.outcome,
      recommendation: row.errors[0]?.recommendation ?? RECOMMENDATIONS[row.outcome] ?? 'Periksa data pada file sumber.',
    }));
}
