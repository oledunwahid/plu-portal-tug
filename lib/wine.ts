/**
 * Wine List domain rules - pure, no DB, no request context. Everything here is shared by the API
 * routes, the import pipeline and the client form so a rule can never drift between them.
 */

export const WINE_MASTER_DATA_TYPES = [
  'PRODUCER',
  'COUNTRY',
  'REGION',
  'APPELLATION',
  'VARIETAL',
  'WINE_TYPE',
  'CATEGORY',
  'SUB_CATEGORY',
  'BOTTLE_SIZE',
  'CLASSIFICATION',
] as const;

export type WineMasterDataType = (typeof WINE_MASTER_DATA_TYPES)[number];

export const WINE_MASTER_DATA_LABELS: Record<WineMasterDataType, string> = {
  PRODUCER: 'Producer',
  COUNTRY: 'Country',
  REGION: 'Region',
  APPELLATION: 'Appellation',
  VARIETAL: 'Varietal',
  WINE_TYPE: 'Wine Type',
  CATEGORY: 'Wine Category',
  SUB_CATEGORY: 'Wine Sub Category',
  BOTTLE_SIZE: 'Bottle Size',
  CLASSIFICATION: 'Classification',
};

export function isWineMasterDataType(value: string): value is WineMasterDataType {
  return (WINE_MASTER_DATA_TYPES as readonly string[]).includes(value);
}

export type WineStatus = 'Active' | 'Inactive';

// ── Name normalization ───────────────────────────────────────────────────────

/**
 * Normalized form used for duplicate detection and for the unique index on wine master data.
 *
 * Folds case, accents, curly quotes and minor punctuation, and collapses whitespace, so
 * "Bouchard Père & Fils", "BOUCHARD PERE & FILS" and "Bouchard Pere &  Fils" all collapse to one
 * key. Digits are preserved verbatim - vintages and bottle sizes are meaningful, and stripping them
 * would merge genuinely different products (rule 12: a different vintage is a different product).
 */
export function normalizeWineText(value: string | null | undefined): string {
  return String(value ?? '')
    // Curly quotes / primes → ASCII apostrophe before the accent fold, so "L'Ermita" in either
    // quote style collapses to one key.
    .replace(/[‘’ʼ′`´]/g, "'")
    .replace(/[“”″]/g, '"')
    // Every dash variant → plain hyphen.
    .replace(/[‐-―−]/g, '-')
    .normalize('NFD')
    // Strip combining accent marks (é → e).
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Punctuation that carries no meaning for identity → space. `&` is intentionally NOT folded to
    // "and": "Cork & Screw" and "Cork and Screw" stay distinct names.
    .replace(/['".,;:!?()[\]{}/\\|+*_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Key used for the "same wine, same vintage, same format" potential-duplicate rule. */
export function wineIdentityKey(parts: {
  producerName?: string | null;
  wineName?: string | null;
  vintage?: number | null;
  isNonVintage?: boolean;
  bottleSizeName?: string | null;
}): string {
  const vintage = parts.isNonVintage ? 'NV' : parts.vintage != null ? String(parts.vintage) : '';
  return [
    normalizeWineText(parts.producerName),
    normalizeWineText(parts.wineName),
    vintage,
    normalizeWineText(parts.bottleSizeName),
  ].join('|');
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface WineFieldInput {
  masterItemId?: string | null;
  wineName?: string | null;
  displayName?: string | null;
  producerId?: string | null;
  countryId?: string | null;
  regionId?: string | null;
  appellationId?: string | null;
  classificationId?: string | null;
  wineTypeId?: string | null;
  categoryId?: string | null;
  subCategory1Id?: string | null;
  subCategory2Id?: string | null;
  bottleSizeId?: string | null;
  vintage?: number | null;
  isNonVintage?: boolean;
  abv?: number | null;
  costPerBottle?: number | null;
  varietals?: { varietalId: string; percentage?: number | null }[];
  status?: string | null;
}

export interface WineValidationIssue {
  field: string;
  message: string;
}

/** Indonesian messages, matching the rest of the portal's validation copy. */
export const WINE_MESSAGES = {
  wineNameRequired: 'Wine Name wajib diisi.',
  producerRequired: 'Pilih Producer terlebih dahulu.',
  bottleSizeRequired: 'Bottle Size wajib dipilih.',
  wineTypeRequired: 'Wine Type wajib dipilih.',
  vintageFourDigits: 'Vintage harus berupa empat digit.',
  vintageFuture: 'Vintage tidak boleh lebih besar dari tahun berjalan.',
  vintageMissing: 'Pilih Non-Vintage apabila wine tidak memiliki tahun.',
  vintageWithNonVintage: 'Vintage harus kosong apabila Non-Vintage dipilih.',
  masterItemRequired: 'Wine harus terhubung dengan satu Master Item.',
  masterItemTaken: 'Master Item ini sudah terhubung dengan Wine List.',
  masterItemNotFound: 'Master Item tidak ditemukan.',
  barcodeTaken: 'Barcode ini sudah digunakan oleh item lain.',
  pluTaken: 'PLU Code ini sudah digunakan oleh Master Item lain.',
  requestPublished: 'Request ini sudah pernah dipublikasikan.',
  costForbidden: 'Anda tidak memiliki akses untuk melihat cost.',
  abvRange: 'ABV harus di antara 0 dan 100.',
  costNegative: 'Cost per Bottle tidak boleh negatif.',
  loadFailed: 'Data Wine List gagal dimuat. Silakan coba kembali.',
  emptyList:
    'Belum ada wine yang terdaftar. Tambahkan wine dari Master Item atau publish request yang sudah selesai.',
} as const;

/**
 * Field-level rules (PRD §6 rules 3-11 + 19). Cross-record rules (master item already linked,
 * duplicate barcode/PLU, request already published) need the DB and live in lib/wineDb.ts.
 *
 * `currentYear` is injectable so the rule is testable and so a server/client clock split can't make
 * the same payload valid in the browser and invalid on the server.
 */
export function validateWineFields(
  input: WineFieldInput,
  currentYear: number = new Date().getFullYear(),
): WineValidationIssue[] {
  const issues: WineValidationIssue[] = [];

  if (!String(input.wineName ?? '').trim()) {
    issues.push({ field: 'wineName', message: WINE_MESSAGES.wineNameRequired });
  }
  if (!String(input.producerId ?? '').trim()) {
    issues.push({ field: 'producerId', message: WINE_MESSAGES.producerRequired });
  }
  if (!String(input.bottleSizeId ?? '').trim()) {
    issues.push({ field: 'bottleSizeId', message: WINE_MESSAGES.bottleSizeRequired });
  }
  if (!String(input.wineTypeId ?? '').trim()) {
    issues.push({ field: 'wineTypeId', message: WINE_MESSAGES.wineTypeRequired });
  }

  const nonVintage = input.isNonVintage === true;
  const vintage = input.vintage;
  if (nonVintage) {
    // Rule 10/11: Non-Vintage is a flag, never a sentinel year like 0 or 9999.
    if (vintage != null) {
      issues.push({ field: 'vintage', message: WINE_MESSAGES.vintageWithNonVintage });
    }
  } else if (vintage == null) {
    issues.push({ field: 'vintage', message: WINE_MESSAGES.vintageMissing });
  } else if (!Number.isInteger(vintage) || vintage < 1000 || vintage > 9999) {
    issues.push({ field: 'vintage', message: WINE_MESSAGES.vintageFourDigits });
  } else if (vintage > currentYear) {
    issues.push({ field: 'vintage', message: WINE_MESSAGES.vintageFuture });
  }

  if (input.abv != null && (Number.isNaN(input.abv) || input.abv < 0 || input.abv > 100)) {
    issues.push({ field: 'abv', message: WINE_MESSAGES.abvRange });
  }
  if (input.costPerBottle != null && (Number.isNaN(input.costPerBottle) || input.costPerBottle < 0)) {
    issues.push({ field: 'costPerBottle', message: WINE_MESSAGES.costNegative });
  }

  return issues;
}

/**
 * Parse a vintage cell from a form field or an import row. Returns `undefined` when the value is a
 * recognised "no vintage" marker so the caller can set isNonVintage instead of storing a fake year
 * (rule 11).
 */
export function parseVintage(raw: unknown): { vintage: number | null; nonVintage: boolean } {
  const text = String(raw ?? '').trim();
  if (!text) return { vintage: null, nonVintage: false };
  const upper = text.toUpperCase().replace(/[.\s]/g, '');
  if (['NV', 'N/V', 'NONVINTAGE', 'NONVINTAGED', 'MULTIVINTAGE', 'MV'].includes(upper)) {
    return { vintage: null, nonVintage: true };
  }
  // Legacy files store "no vintage" as these sentinels - normalise them to the flag.
  if (['0', '00', '0000', '9999', '1900'].includes(upper)) {
    return { vintage: null, nonVintage: true };
  }
  const match = text.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
  if (match) return { vintage: Number(match[1]), nonVintage: false };
  return { vintage: null, nonVintage: false };
}

/** Money/number cell parser tolerant of "Rp 1.250.000", "1,250,000.50" and blanks. */
export function parseWineNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let text = String(raw).trim();
  if (!text) return null;
  text = text.replace(/[^\d.,-]/g, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    // European style: dots group thousands, comma is the decimal separator.
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatVintage(vintage: number | null, isNonVintage: boolean): string {
  if (isNonVintage) return 'NV';
  return vintage != null ? String(vintage) : '—';
}

/**
 * A wine record counts as "complete" when every field the wine team needs downstream is filled.
 * Drives the Complete/Incomplete filter and the list badge, and is the yardstick for legacy rows
 * imported with gaps.
 */
export const WINE_COMPLETENESS_FIELDS = [
  'producerId',
  'countryId',
  'regionId',
  'appellationId',
  'wineTypeId',
  'bottleSizeId',
] as const;

export function wineCompleteness(wine: {
  producerId?: string | null;
  countryId?: string | null;
  regionId?: string | null;
  appellationId?: string | null;
  wineTypeId?: string | null;
  bottleSizeId?: string | null;
  vintage?: number | null;
  isNonVintage?: boolean;
  varietalCount?: number;
}): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const field of WINE_COMPLETENESS_FIELDS) {
    if (!String(wine[field] ?? '').trim()) missing.push(field);
  }
  if (!wine.isNonVintage && wine.vintage == null) missing.push('vintage');
  if (!wine.varietalCount) missing.push('varietals');
  return { complete: missing.length === 0, missing };
}
