/**
 * Wine List data access.
 *
 * Lives beside lib/db.ts rather than inside it (that file is already ~3k lines) but shares its
 * primitives through `_internal`, so wine writes go through the same serialising write queue and
 * the same single sql.js handle as everything else.
 *
 * SOURCE OF TRUTH: every POS-owned field (PLU code, barcode, price, folder, outlets, UOM, tax /
 * service charge / no-discount flags, active-per-outlet) is read by JOINing MasterItem. WineMaster
 * never stores an editable copy. `masterItemCode` / `masterItemName` exist only so the list can
 * search and sort without a join penalty, and are refreshed whenever the link is (re)written.
 */

import { _internal, type DbMasterItem } from './db';
import {
  normalizeWineText,
  isWineMasterDataType,
  type WineMasterDataType,
  type WineStatus,
} from './wine';
import type { MasterLookup } from './wineImport';

/** Minimal Master Item shape the import matcher needs. */
type MasterRef = { id: string; code: string; name: string };

const { getDb, withWriteLock, execAll, execFirst, newId, nowIso, normBool, normStr } = _internal;

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbWineMaster {
  id: string;
  masterItemId: string;
  masterItemCode: string | null;
  masterItemName: string | null;
  sourceRequestId: string | null;
  legacyWineCode: string | null;
  importBatchId: string | null;
  wineName: string;
  normalizedName: string;
  displayName: string | null;
  producerId: string | null;
  countryId: string | null;
  regionId: string | null;
  appellationId: string | null;
  classificationId: string | null;
  wineTypeId: string | null;
  categoryId: string | null;
  subCategory1Id: string | null;
  subCategory2Id: string | null;
  bottleSizeId: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  abv: number | null;
  description: string | null;
  tastingNotes: string | null;
  foodPairing: string | null;
  servingTemperature: string | null;
  internalNotes: string | null;
  costPerBottle: number | null;
  status: WineStatus;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Resolved reference-data names + the joined Master Item snapshot, for list & detail views. */
export interface WineMasterView extends DbWineMaster {
  producerName: string | null;
  countryName: string | null;
  regionName: string | null;
  appellationName: string | null;
  classificationName: string | null;
  wineTypeName: string | null;
  categoryName: string | null;
  subCategory1Name: string | null;
  subCategory2Name: string | null;
  bottleSizeName: string | null;
  varietalCount: number;
  varietalNames: string | null;
  /** Null when the linked Master Item has since been deleted from the registry. */
  master: DbMasterItem | null;
  /** True when another Wine Master shares normalized name + vintage + bottle size. */
  duplicateIndication: boolean;
}

export interface DbWineVarietal {
  id: string;
  wineMasterId: string;
  varietalId: string;
  varietalName: string | null;
  percentage: number | null;
}

export interface DbWineMasterDataItem {
  id: string;
  type: string;
  code: string | null;
  name: string;
  normalizedName: string;
  status: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface DbWineAuditLog {
  id: string;
  wineMasterId: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string | null;
  performedAt: string;
}

export interface DbWineImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  duplicateRows: number;
  failedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  status: string;
  uploadedBy: string | null;
  uploadedAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
}

export interface DbWineImportError {
  id: string;
  importBatchId: string;
  rowNumber: number;
  wineName: string | null;
  pluCode: string | null;
  barcode: string | null;
  error: string;
  recommendation: string | null;
  createdAt: string;
}

export type WineSortKey = 'wineName' | 'vintage' | 'producer' | 'price' | 'updatedAt' | 'createdAt';

export interface WineListFilters {
  search?: string;
  status?: WineStatus | 'ALL';
  producerId?: string;
  countryId?: string;
  regionId?: string;
  appellationId?: string;
  wineTypeId?: string;
  categoryId?: string;
  bottleSizeId?: string;
  vintage?: string;
  outlet?: string;
  /** 'COMPLETE' | 'INCOMPLETE' - see WINE_COMPLETE_SQL. */
  completeness?: 'COMPLETE' | 'INCOMPLETE';
  duplicatesOnly?: boolean;
  sort?: WineSortKey;
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface WineWriteInput {
  masterItemId: string;
  sourceRequestId?: string | null;
  legacyWineCode?: string | null;
  importBatchId?: string | null;
  wineName: string;
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
  description?: string | null;
  tastingNotes?: string | null;
  foodPairing?: string | null;
  servingTemperature?: string | null;
  internalNotes?: string | null;
  costPerBottle?: number | null;
  status?: WineStatus;
  varietals?: { varietalId: string; percentage?: number | null }[];
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function rowToWineMaster(row: Record<string, unknown>): DbWineMaster {
  return {
    id: String(row.id),
    masterItemId: String(row.masterItemId),
    masterItemCode: normStr(row.masterItemCode),
    masterItemName: normStr(row.masterItemName),
    sourceRequestId: normStr(row.sourceRequestId),
    legacyWineCode: normStr(row.legacyWineCode),
    importBatchId: normStr(row.importBatchId),
    wineName: String(row.wineName),
    normalizedName: String(row.normalizedName ?? ''),
    displayName: normStr(row.displayName),
    producerId: normStr(row.producerId),
    countryId: normStr(row.countryId),
    regionId: normStr(row.regionId),
    appellationId: normStr(row.appellationId),
    classificationId: normStr(row.classificationId),
    wineTypeId: normStr(row.wineTypeId),
    categoryId: normStr(row.categoryId),
    subCategory1Id: normStr(row.subCategory1Id),
    subCategory2Id: normStr(row.subCategory2Id),
    bottleSizeId: normStr(row.bottleSizeId),
    vintage: row.vintage != null ? Number(row.vintage) : null,
    isNonVintage: normBool(row.isNonVintage),
    abv: row.abv != null ? Number(row.abv) : null,
    description: normStr(row.description),
    tastingNotes: normStr(row.tastingNotes),
    foodPairing: normStr(row.foodPairing),
    servingTemperature: normStr(row.servingTemperature),
    internalNotes: normStr(row.internalNotes),
    costPerBottle: row.costPerBottle != null ? Number(row.costPerBottle) : null,
    status: (String(row.status ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active'),
    createdAt: String(row.createdAt),
    createdBy: normStr(row.createdBy),
    updatedAt: String(row.updatedAt),
    updatedBy: normStr(row.updatedBy),
  };
}

/** Rebuilds the joined MasterItem columns (prefixed `m_`) into a DbMasterItem. */
function rowToJoinedMaster(row: Record<string, unknown>): DbMasterItem | null {
  if (row.m_id == null) return null;
  return {
    id: String(row.m_id),
    active: normBool(row.m_active),
    code: String(row.m_code ?? ''),
    name: String(row.m_name ?? ''),
    category: String(row.m_category ?? ''),
    department: String(row.m_department ?? ''),
    salesDef: String(row.m_salesDef ?? 'SALES'),
    price: row.m_price != null ? Number(row.m_price) : null,
    plu: normStr(row.m_plu),
    barcode: normStr(row.m_barcode),
    uom: normStr(row.m_uom),
    folder: normStr(row.m_folder),
    serviceCharge: normBool(row.m_serviceCharge),
    tax1: normBool(row.m_tax1),
    tax2: normBool(row.m_tax2),
    noDiscount: normBool(row.m_noDiscount),
    hideReceipt: normBool(row.m_hideReceipt),
    printers: normStr(row.m_printers),
    outlets: normStr(row.m_outlets),
    outletGroup: normStr(row.m_outletGroup),
    priceLevels: normStr(row.m_priceLevels),
    importedAt: String(row.m_importedAt ?? ''),
    updatedAt: String(row.m_updatedAt ?? ''),
  };
}

function rowToWineMasterView(row: Record<string, unknown>): WineMasterView {
  return {
    ...rowToWineMaster(row),
    producerName: normStr(row.producerName),
    countryName: normStr(row.countryName),
    regionName: normStr(row.regionName),
    appellationName: normStr(row.appellationName),
    classificationName: normStr(row.classificationName),
    wineTypeName: normStr(row.wineTypeName),
    categoryName: normStr(row.categoryName),
    subCategory1Name: normStr(row.subCategory1Name),
    subCategory2Name: normStr(row.subCategory2Name),
    bottleSizeName: normStr(row.bottleSizeName),
    varietalCount: row.varietalCount != null ? Number(row.varietalCount) : 0,
    varietalNames: normStr(row.varietalNames),
    master: rowToJoinedMaster(row),
    duplicateIndication: normBool(row.duplicateIndication),
  };
}

function rowToWineMasterDataItem(row: Record<string, unknown>): DbWineMasterDataItem {
  return {
    id: String(row.id),
    type: String(row.type),
    code: normStr(row.code),
    name: String(row.name),
    normalizedName: String(row.normalizedName),
    status: String(row.status ?? 'Active'),
    createdAt: String(row.createdAt),
    createdBy: normStr(row.createdBy),
    updatedAt: String(row.updatedAt),
    updatedBy: normStr(row.updatedBy),
  };
}

function rowToAuditLog(row: Record<string, unknown>): DbWineAuditLog {
  return {
    id: String(row.id),
    wineMasterId: String(row.wineMasterId),
    action: String(row.action),
    fieldName: normStr(row.fieldName),
    oldValue: normStr(row.oldValue),
    newValue: normStr(row.newValue),
    performedBy: normStr(row.performedBy),
    performedAt: String(row.performedAt),
  };
}

function rowToImportBatch(row: Record<string, unknown>): DbWineImportBatch {
  const num = (v: unknown) => (v != null ? Number(v) : 0);
  return {
    id: String(row.id),
    fileName: String(row.fileName),
    totalRows: num(row.totalRows),
    createdRows: num(row.createdRows),
    updatedRows: num(row.updatedRows),
    duplicateRows: num(row.duplicateRows),
    failedRows: num(row.failedRows),
    skippedRows: num(row.skippedRows),
    matchedRows: num(row.matchedRows),
    unmatchedRows: num(row.unmatchedRows),
    status: String(row.status ?? 'COMPLETED'),
    uploadedBy: normStr(row.uploadedBy),
    uploadedAt: String(row.uploadedAt),
    completedAt: normStr(row.completedAt),
    rolledBackAt: normStr(row.rolledBackAt),
    rolledBackBy: normStr(row.rolledBackBy),
  };
}

// ── Shared SQL fragments ─────────────────────────────────────────────────────

const MASTER_JOIN_COLUMNS = [
  'id', 'active', 'code', 'name', 'category', 'department', 'salesDef', 'price', 'plu', 'barcode',
  'uom', 'folder', 'serviceCharge', 'tax1', 'tax2', 'noDiscount', 'hideReceipt', 'printers',
  'outlets', 'outletGroup', 'priceLevels', 'importedAt', 'updatedAt',
].map((c) => `m."${c}" AS m_${c}`).join(', ');

/**
 * SQL mirror of wineCompleteness() in lib/wine.ts. Kept as SQL so the Complete/Incomplete filter
 * stays backend-side over 7k rows; if the field list there changes, change it here too.
 */
const WINE_COMPLETE_SQL = `(
  COALESCE(w.producerId,'') <> '' AND COALESCE(w.countryId,'') <> '' AND
  COALESCE(w.regionId,'') <> '' AND COALESCE(w.appellationId,'') <> '' AND
  COALESCE(w.wineTypeId,'') <> '' AND COALESCE(w.bottleSizeId,'') <> '' AND
  (w.isNonVintage = 1 OR w.vintage IS NOT NULL) AND
  EXISTS (SELECT 1 FROM "WineVarietal" wvc WHERE wvc.wineMasterId = w.id)
)`;

/** Potential-duplicate signal: same normalized name + vintage + bottle size as another record. */
const WINE_DUP_SQL = `EXISTS (
  SELECT 1 FROM "WineMaster" wd
  WHERE wd.id <> w.id
    AND wd.normalizedName = w.normalizedName
    AND wd.normalizedName <> ''
    AND COALESCE(wd.vintage, -1) = COALESCE(w.vintage, -1)
    AND COALESCE(wd.bottleSizeId,'') = COALESCE(w.bottleSizeId,'')
)`;

const WINE_SELECT_BASE = `
  SELECT w.*,
    p.name  AS producerName,
    c.name  AS countryName,
    r.name  AS regionName,
    a.name  AS appellationName,
    cl.name AS classificationName,
    t.name  AS wineTypeName,
    cat.name AS categoryName,
    s1.name AS subCategory1Name,
    s2.name AS subCategory2Name,
    b.name  AS bottleSizeName,
    ${MASTER_JOIN_COLUMNS},
    (SELECT COUNT(*) FROM "WineVarietal" wv WHERE wv.wineMasterId = w.id) AS varietalCount,
    (SELECT GROUP_CONCAT(vd.name, ', ') FROM "WineVarietal" wv
       LEFT JOIN "WineMasterData" vd ON vd.id = wv.varietalId
      WHERE wv.wineMasterId = w.id) AS varietalNames,
    ${WINE_DUP_SQL} AS duplicateIndication
  FROM "WineMaster" w
  LEFT JOIN "WineMasterData" p   ON p.id   = w.producerId
  LEFT JOIN "WineMasterData" c   ON c.id   = w.countryId
  LEFT JOIN "WineMasterData" r   ON r.id   = w.regionId
  LEFT JOIN "WineMasterData" a   ON a.id   = w.appellationId
  LEFT JOIN "WineMasterData" cl  ON cl.id  = w.classificationId
  LEFT JOIN "WineMasterData" t   ON t.id   = w.wineTypeId
  LEFT JOIN "WineMasterData" cat ON cat.id = w.categoryId
  LEFT JOIN "WineMasterData" s1  ON s1.id  = w.subCategory1Id
  LEFT JOIN "WineMasterData" s2  ON s2.id  = w.subCategory2Id
  LEFT JOIN "WineMasterData" b   ON b.id   = w.bottleSizeId
  LEFT JOIN "MasterItem" m       ON m.id   = w.masterItemId
`;

function buildWineConditions(f: WineListFilters): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (f.search && f.search.trim()) {
    const q = `%${f.search.trim()}%`;
    // Covers wine name, the existing Master Item name (cache + live), PLU code, barcode, producer,
    // appellation, country, region and vintage - the full search contract from the PRD.
    conditions.push(`(
      w.wineName LIKE ? OR w.displayName LIKE ? OR w.masterItemName LIKE ? OR m.name LIKE ?
      OR w.masterItemCode LIKE ? OR m.code LIKE ? OR m.barcode LIKE ? OR w.legacyWineCode LIKE ?
      OR p.name LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR r.name LIKE ?
      OR CAST(w.vintage AS TEXT) LIKE ?
    )`);
    for (let i = 0; i < 13; i += 1) params.push(q);
  }
  if (f.status && f.status !== 'ALL') { conditions.push('w.status = ?'); params.push(f.status); }
  const refFilters: [keyof WineListFilters, string][] = [
    ['producerId', 'w.producerId'],
    ['countryId', 'w.countryId'],
    ['regionId', 'w.regionId'],
    ['appellationId', 'w.appellationId'],
    ['wineTypeId', 'w.wineTypeId'],
    ['categoryId', 'w.categoryId'],
    ['bottleSizeId', 'w.bottleSizeId'],
  ];
  for (const [key, column] of refFilters) {
    const value = f[key];
    if (typeof value === 'string' && value && value !== 'ALL') {
      conditions.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (f.vintage && f.vintage !== 'ALL') {
    if (f.vintage === 'NV') conditions.push('w.isNonVintage = 1');
    else { conditions.push('w.vintage = ?'); params.push(Number(f.vintage)); }
  }
  if (f.outlet && f.outlet !== 'ALL') {
    // Outlets are a ';'-joined list on MasterItem - same matching shape as buildMasterItemConditions.
    const code = f.outlet;
    conditions.push('(m.outlets = ? OR m.outlets LIKE ? OR m.outlets LIKE ? OR m.outlets LIKE ?)');
    params.push(code, `${code};%`, `%;${code};%`, `%;${code}`);
  }
  if (f.completeness === 'COMPLETE') conditions.push(WINE_COMPLETE_SQL);
  if (f.completeness === 'INCOMPLETE') conditions.push(`NOT ${WINE_COMPLETE_SQL}`);
  if (f.duplicatesOnly) conditions.push(WINE_DUP_SQL);

  return { conditions, params };
}

const SORT_COLUMNS: Record<WineSortKey, string> = {
  wineName: 'w.wineName',
  vintage: 'w.vintage',
  producer: 'p.name',
  price: 'm.price',
  updatedAt: 'w.updatedAt',
  createdAt: 'w.createdAt',
};

// ── Wine list / detail reads ─────────────────────────────────────────────────

export async function getWineMasters(filters: WineListFilters = {}): Promise<WineMasterView[]> {
  try {
    const db = await getDb();
    const { conditions, params } = buildWineConditions(filters);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortCol = SORT_COLUMNS[filters.sort ?? 'updatedAt'] ?? SORT_COLUMNS.updatedAt;
    const dir = filters.dir === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100000);
    const offset = Math.max(filters.offset ?? 0, 0);
    const rows = execAll(
      db,
      `${WINE_SELECT_BASE} ${where} ORDER BY ${sortCol} ${dir}, w.wineName ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map(rowToWineMasterView);
  } catch (err) {
    console.error('[wineDb] getWineMasters failed:', err);
    throw err;
  }
}

export async function countWineMasters(filters: WineListFilters = {}): Promise<number> {
  try {
    const db = await getDb();
    const { conditions, params } = buildWineConditions(filters);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // The count needs the same joins as the list: search and the outlet filter reference p/a/c/r/m.
    const row = execFirst(
      db,
      `SELECT COUNT(*) AS cnt FROM "WineMaster" w
         LEFT JOIN "WineMasterData" p ON p.id = w.producerId
         LEFT JOIN "WineMasterData" c ON c.id = w.countryId
         LEFT JOIN "WineMasterData" r ON r.id = w.regionId
         LEFT JOIN "WineMasterData" a ON a.id = w.appellationId
         LEFT JOIN "MasterItem" m     ON m.id = w.masterItemId
       ${where}`,
      params,
    );
    return row ? Number(row.cnt) : 0;
  } catch (err) {
    console.error('[wineDb] countWineMasters failed:', err);
    throw err;
  }
}

export async function getWineMasterById(id: string): Promise<WineMasterView | null> {
  try {
    const db = await getDb();
    const row = execFirst(db, `${WINE_SELECT_BASE} WHERE w.id = ? LIMIT 1`, [id]);
    return row ? rowToWineMasterView(row) : null;
  } catch (err) {
    console.error('[wineDb] getWineMasterById failed:', err);
    throw err;
  }
}

export async function getWineVarietals(wineMasterId: string): Promise<DbWineVarietal[]> {
  try {
    const db = await getDb();
    const rows = execAll(
      db,
      `SELECT wv.*, d.name AS varietalName FROM "WineVarietal" wv
         LEFT JOIN "WineMasterData" d ON d.id = wv.varietalId
        WHERE wv.wineMasterId = ? ORDER BY wv.percentage DESC, d.name ASC`,
      [wineMasterId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      wineMasterId: String(r.wineMasterId),
      varietalId: String(r.varietalId),
      varietalName: normStr(r.varietalName),
      percentage: r.percentage != null ? Number(r.percentage) : null,
    }));
  } catch (err) {
    console.error('[wineDb] getWineVarietals failed:', err);
    return [];
  }
}

export async function getWineAuditLogs(wineMasterId: string, limit = 200): Promise<DbWineAuditLog[]> {
  try {
    const db = await getDb();
    const rows = execAll(
      db,
      'SELECT * FROM "WineAuditLog" WHERE wineMasterId = ? ORDER BY performedAt DESC, rowid DESC LIMIT ?',
      [wineMasterId, limit],
    );
    return rows.map(rowToAuditLog);
  } catch (err) {
    console.error('[wineDb] getWineAuditLogs failed:', err);
    return [];
  }
}

/** Distinct vintages present in the catalog, newest first - powers the Vintage filter. */
export async function getWineVintageOptions(): Promise<number[]> {
  try {
    const db = await getDb();
    const rows = execAll(
      db,
      'SELECT DISTINCT vintage FROM "WineMaster" WHERE vintage IS NOT NULL ORDER BY vintage DESC',
    );
    return rows.map((r) => Number(r.vintage));
  } catch {
    return [];
  }
}

/** Outlet codes actually used by linked Master Items - powers the Outlet filter. */
export async function getWineOutletOptions(): Promise<string[]> {
  try {
    const db = await getDb();
    const rows = execAll(
      db,
      `SELECT DISTINCT m.outlets AS outlets FROM "WineMaster" w
         JOIN "MasterItem" m ON m.id = w.masterItemId
        WHERE COALESCE(m.outlets,'') <> ''`,
    );
    const set = new Set<string>();
    for (const row of rows) {
      for (const code of String(row.outlets ?? '').split(/[;,]/)) {
        const trimmed = code.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort();
  } catch {
    return [];
  }
}

export async function getWineListStats(): Promise<{ total: number; active: number; inactive: number }> {
  try {
    const db = await getDb();
    const row = execFirst(
      db,
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status <> 'Active' THEN 1 ELSE 0 END) AS inactive
         FROM "WineMaster"`,
    );
    return {
      total: row ? Number(row.total ?? 0) : 0,
      active: row ? Number(row.active ?? 0) : 0,
      inactive: row ? Number(row.inactive ?? 0) : 0,
    };
  } catch {
    return { total: 0, active: 0, inactive: 0 };
  }
}

// ── Wine master data (reference lists) ───────────────────────────────────────

export async function getWineMasterData(
  type?: WineMasterDataType,
  opts: { search?: string; includeInactive?: boolean; limit?: number } = {},
): Promise<DbWineMasterDataItem[]> {
  try {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (!opts.includeInactive) conditions.push("status = 'Active'");
    if (opts.search && opts.search.trim()) {
      conditions.push('(name LIKE ? OR normalizedName LIKE ? OR code LIKE ?)');
      const q = `%${opts.search.trim()}%`;
      params.push(q, normalizeWineText(opts.search), q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = execAll(
      db,
      `SELECT * FROM "WineMasterData" ${where} ORDER BY type ASC, name ASC LIMIT ?`,
      [...params, opts.limit ?? 5000],
    );
    return rows.map(rowToWineMasterDataItem);
  } catch (err) {
    console.error('[wineDb] getWineMasterData failed:', err);
    return [];
  }
}

export async function getWineMasterDataById(id: string): Promise<DbWineMasterDataItem | null> {
  try {
    const db = await getDb();
    const row = execFirst(db, 'SELECT * FROM "WineMasterData" WHERE id = ? LIMIT 1', [id]);
    return row ? rowToWineMasterDataItem(row) : null;
  } catch {
    return null;
  }
}

export async function findWineMasterDataByName(
  type: WineMasterDataType,
  name: string,
): Promise<DbWineMasterDataItem | null> {
  try {
    const db = await getDb();
    const row = execFirst(
      db,
      'SELECT * FROM "WineMasterData" WHERE type = ? AND normalizedName = ? LIMIT 1',
      [type, normalizeWineText(name)],
    );
    return row ? rowToWineMasterDataItem(row) : null;
  } catch {
    return null;
  }
}

export async function createWineMasterDataItem(input: {
  type: WineMasterDataType;
  name: string;
  code?: string | null;
  performedBy?: string | null;
}): Promise<{ item: DbWineMasterDataItem | null; duplicate: DbWineMasterDataItem | null }> {
  const name = input.name.trim();
  const normalized = normalizeWineText(name);
  if (!name || !normalized) return { item: null, duplicate: null };
  return withWriteLock((db) => {
    // Normalized-name uniqueness is what stops "Bouchard Père & Fils" being re-created as
    // "BOUCHARD PERE & FILS". Checked here (not only via the unique index) so the caller can show
    // the existing record instead of a raw constraint error.
    const existing = execFirst(
      db,
      'SELECT * FROM "WineMasterData" WHERE type = ? AND normalizedName = ? LIMIT 1',
      [input.type, normalized],
    );
    if (existing) return { item: null, duplicate: rowToWineMasterDataItem(existing) };
    const id = newId();
    const now = nowIso();
    db.run(
      `INSERT INTO "WineMasterData" (id, type, code, name, normalizedName, status, createdAt, createdBy, updatedAt, updatedBy)
       VALUES (?,?,?,?,?,'Active',?,?,?,?)`,
      [id, input.type, input.code ?? null, name, normalized, now, input.performedBy ?? null, now, input.performedBy ?? null],
    );
    const row = execFirst(db, 'SELECT * FROM "WineMasterData" WHERE id = ?', [id]);
    return { item: row ? rowToWineMasterDataItem(row) : null, duplicate: null };
  });
}

export async function updateWineMasterDataItem(
  id: string,
  data: { name?: string; code?: string | null; status?: string; performedBy?: string | null },
): Promise<{ item: DbWineMasterDataItem | null; duplicate: DbWineMasterDataItem | null }> {
  return withWriteLock((db) => {
    const current = execFirst(db, 'SELECT * FROM "WineMasterData" WHERE id = ? LIMIT 1', [id]);
    if (!current) return { item: null, duplicate: null };
    const sets: string[] = ['updatedAt = ?', 'updatedBy = ?'];
    const vals: unknown[] = [nowIso(), data.performedBy ?? null];
    if (data.name !== undefined) {
      const name = data.name.trim();
      const normalized = normalizeWineText(name);
      if (!name || !normalized) return { item: rowToWineMasterDataItem(current), duplicate: null };
      const clash = execFirst(
        db,
        'SELECT * FROM "WineMasterData" WHERE type = ? AND normalizedName = ? AND id <> ? LIMIT 1',
        [String(current.type), normalized, id],
      );
      if (clash) return { item: null, duplicate: rowToWineMasterDataItem(clash) };
      sets.push('name = ?', 'normalizedName = ?');
      vals.push(name, normalized);
    }
    if (data.code !== undefined) { sets.push('code = ?'); vals.push(data.code ?? null); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status === 'Inactive' ? 'Inactive' : 'Active'); }
    vals.push(id);
    db.run(`UPDATE "WineMasterData" SET ${sets.join(', ')} WHERE id = ?`, vals);
    const row = execFirst(db, 'SELECT * FROM "WineMasterData" WHERE id = ?', [id]);
    return { item: row ? rowToWineMasterDataItem(row) : null, duplicate: null };
  });
}

/**
 * Get-or-create by normalized name. Used by the legacy import, which arrives with free-text producer
 * / appellation / varietal names and must converge on one record per real-world entity.
 */
export async function ensureWineMasterDataIds(
  entries: { type: WineMasterDataType; name: string }[],
  performedBy?: string | null,
): Promise<Map<string, string>> {
  const wanted = new Map<string, { type: WineMasterDataType; name: string; normalized: string }>();
  for (const entry of entries) {
    const name = String(entry.name ?? '').trim();
    const normalized = normalizeWineText(name);
    if (!name || !normalized || !isWineMasterDataType(entry.type)) continue;
    wanted.set(`${entry.type}::${normalized}`, { type: entry.type, name, normalized });
  }
  if (wanted.size === 0) return new Map();
  return withWriteLock((db) => {
    const out = new Map<string, string>();
    const now = nowIso();
    for (const [key, entry] of Array.from(wanted.entries())) {
      const existing = execFirst(
        db,
        'SELECT id FROM "WineMasterData" WHERE type = ? AND normalizedName = ? LIMIT 1',
        [entry.type, entry.normalized],
      );
      if (existing) { out.set(key, String(existing.id)); continue; }
      const id = newId();
      db.run(
        `INSERT INTO "WineMasterData" (id, type, code, name, normalizedName, status, createdAt, createdBy, updatedAt, updatedBy)
         VALUES (?,?,NULL,?,?,'Active',?,?,?,?)`,
        [id, entry.type, entry.name, entry.normalized, now, performedBy ?? null, now, performedBy ?? null],
      );
      out.set(key, id);
    }
    return out;
  });
}

export function wineMasterDataKey(type: WineMasterDataType, name: string): string {
  return `${type}::${normalizeWineText(name)}`;
}

// ── Duplicate detection ──────────────────────────────────────────────────────

export interface WineDuplicateMatch {
  id: string;
  wineName: string;
  vintage: number | null;
  isNonVintage: boolean;
  producerName: string | null;
  bottleSizeName: string | null;
  status: string;
  pluCode: string | null;
  barcode: string | null;
}

export interface WineDuplicateResult {
  /** Save must be blocked. */
  exact: { reason: string; message: string; match?: WineDuplicateMatch }[];
  /** Save may proceed after the user confirms. */
  potential: { reason: string; match: WineDuplicateMatch }[];
}

function rowToDuplicateMatch(row: Record<string, unknown>): WineDuplicateMatch {
  return {
    id: String(row.id),
    wineName: String(row.wineName),
    vintage: row.vintage != null ? Number(row.vintage) : null,
    isNonVintage: normBool(row.isNonVintage),
    producerName: normStr(row.producerName),
    bottleSizeName: normStr(row.bottleSizeName),
    status: String(row.status ?? 'Active'),
    pluCode: normStr(row.pluCode),
    barcode: normStr(row.barcode),
  };
}

const DUP_SELECT = `
  SELECT w.id, w.wineName, w.vintage, w.isNonVintage, w.status,
         p.name AS producerName, b.name AS bottleSizeName,
         COALESCE(m.code, w.masterItemCode) AS pluCode, m.barcode AS barcode
    FROM "WineMaster" w
    LEFT JOIN "WineMasterData" p ON p.id = w.producerId
    LEFT JOIN "WineMasterData" b ON b.id = w.bottleSizeId
    LEFT JOIN "MasterItem" m ON m.id = w.masterItemId
`;

/**
 * Runs the full duplicate contract (PRD §11).
 *
 * Exact (blocking):
 *  - the Master Item is already linked to an ACTIVE Wine Master
 *  - the source request has already been published
 *  - the Master Item's PLU code or barcode collides with a different Master Item
 * Potential (warning): producer + wine name + vintage + bottle size, or normalized wine name +
 * vintage + bottle size, already exists.
 */
export async function checkWineDuplicates(input: {
  masterItemId?: string | null;
  sourceRequestId?: string | null;
  wineName?: string | null;
  producerId?: string | null;
  bottleSizeId?: string | null;
  vintage?: number | null;
  isNonVintage?: boolean;
  /** Ignore this Wine Master when editing an existing record. */
  excludeWineId?: string | null;
}): Promise<WineDuplicateResult> {
  const db = await getDb();
  const result: WineDuplicateResult = { exact: [], potential: [] };
  const exclude = input.excludeWineId ?? '';

  // Checked before the Master Item rules: when a request has already been published, BOTH this and
  // MASTER_ITEM_LINKED fire, and "request sudah dipublikasikan" is the message that actually explains
  // the situation (callers surface exact[0]).
  if (input.sourceRequestId) {
    const published = execFirst(
      db,
      `${DUP_SELECT} WHERE w.sourceRequestId = ? AND w.id <> ? LIMIT 1`,
      [input.sourceRequestId, exclude],
    );
    if (published) {
      result.exact.push({
        reason: 'REQUEST_ALREADY_PUBLISHED',
        message: 'Request ini sudah pernah dipublikasikan.',
        match: rowToDuplicateMatch(published),
      });
    }
  }

  if (input.masterItemId) {
    const linked = execFirst(
      db,
      `${DUP_SELECT} WHERE w.masterItemId = ? AND w.status = 'Active' AND w.id <> ? LIMIT 1`,
      [input.masterItemId, exclude],
    );
    if (linked) {
      result.exact.push({
        reason: 'MASTER_ITEM_LINKED',
        message: 'Master Item ini sudah terhubung dengan Wine List.',
        match: rowToDuplicateMatch(linked),
      });
    }

    const master = execFirst(db, 'SELECT * FROM "MasterItem" WHERE id = ? LIMIT 1', [input.masterItemId]);
    if (!master) {
      result.exact.push({ reason: 'MASTER_ITEM_MISSING', message: 'Master Item tidak ditemukan.' });
    } else {
      // Rule 13/14 - registry-level integrity. Reported here (not fixed here): the Wine List never
      // edits PLU codes or barcodes, so the remedy is an admin correction on the master registry.
      const code = String(master.code ?? '').trim();
      if (code) {
        const codeClash = execFirst(
          db,
          'SELECT id, code FROM "MasterItem" WHERE code = ? AND id <> ? LIMIT 1',
          [code, String(master.id)],
        );
        if (codeClash) {
          result.exact.push({
            reason: 'PLU_CODE_DUPLICATE',
            message: 'PLU Code ini sudah digunakan oleh Master Item lain.',
          });
        }
      }
      const barcode = String(master.barcode ?? '').trim();
      if (barcode) {
        const barcodeClash = execFirst(
          db,
          `SELECT id FROM "MasterItem"
            WHERE active = 1 AND id <> ? AND LOWER(TRIM(COALESCE(barcode,''))) = ? LIMIT 1`,
          [String(master.id), barcode.toLowerCase()],
        );
        if (barcodeClash) {
          result.exact.push({
            reason: 'BARCODE_DUPLICATE',
            message: 'Barcode ini sudah digunakan oleh item lain.',
          });
        }
      }
    }
  }

  const normalized = normalizeWineText(input.wineName);
  if (normalized) {
    const vintageClause = input.isNonVintage
      ? 'w.isNonVintage = 1'
      : input.vintage != null ? 'w.vintage = ?' : 'w.vintage IS NULL';
    const params: unknown[] = [normalized];
    if (!input.isNonVintage && input.vintage != null) params.push(input.vintage);
    const sizeClause = "COALESCE(w.bottleSizeId,'') = ?";
    params.push(input.bottleSizeId ?? '');
    params.push(exclude);

    const rows = execAll(
      db,
      `${DUP_SELECT} WHERE w.normalizedName = ? AND ${vintageClause} AND ${sizeClause} AND w.id <> ? LIMIT 10`,
      params,
    );
    for (const row of rows) {
      const match = rowToDuplicateMatch(row);
      // Same producer as well → the stronger of the two signals; label it accordingly.
      const sameProducer = input.producerId
        ? execFirst(db, 'SELECT 1 AS ok FROM "WineMaster" WHERE id = ? AND producerId = ?', [match.id, input.producerId])
        : null;
      result.potential.push({
        reason: sameProducer ? 'PRODUCER_NAME_VINTAGE_SIZE' : 'NAME_VINTAGE_SIZE',
        match,
      });
    }
  }

  return result;
}

/** Cheap single-purpose check used by the create path and the import matcher. */
export async function getActiveWineByMasterItemId(masterItemId: string): Promise<WineMasterView | null> {
  try {
    const db = await getDb();
    const row = execFirst(
      db,
      `${WINE_SELECT_BASE} WHERE w.masterItemId = ? AND w.status = 'Active' LIMIT 1`,
      [masterItemId],
    );
    return row ? rowToWineMasterView(row) : null;
  } catch {
    return null;
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────

const WINE_WRITE_FIELDS = [
  'wineName', 'displayName', 'producerId', 'countryId', 'regionId', 'appellationId',
  'classificationId', 'wineTypeId', 'categoryId', 'subCategory1Id', 'subCategory2Id',
  'bottleSizeId', 'vintage', 'isNonVintage', 'abv', 'description', 'tastingNotes',
  'foodPairing', 'servingTemperature', 'internalNotes', 'costPerBottle', 'status',
  'legacyWineCode',
] as const;

type WineWriteField = (typeof WINE_WRITE_FIELDS)[number];

function toDbValue(field: WineWriteField, value: unknown): unknown {
  if (field === 'isNonVintage') return value ? 1 : 0;
  if (value === undefined || value === '') return null;
  return value ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeAudit(db: any, entries: {
  wineMasterId: string; action: string; fieldName?: string | null;
  oldValue?: unknown; newValue?: unknown; performedBy?: string | null; performedAt?: string;
}[]): void {
  const stamp = nowIso();
  for (const entry of entries) {
    db.run(
      `INSERT INTO "WineAuditLog" (id, wineMasterId, action, fieldName, oldValue, newValue, performedBy, performedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        newId(), entry.wineMasterId, entry.action, entry.fieldName ?? null,
        entry.oldValue == null ? null : String(entry.oldValue),
        entry.newValue == null ? null : String(entry.newValue),
        entry.performedBy ?? null, entry.performedAt ?? stamp,
      ],
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replaceVarietals(db: any, wineMasterId: string, varietals: { varietalId: string; percentage?: number | null }[]): void {
  db.run('DELETE FROM "WineVarietal" WHERE wineMasterId = ?', [wineMasterId]);
  const seen = new Set<string>();
  for (const v of varietals) {
    const varietalId = String(v.varietalId ?? '').trim();
    if (!varietalId || seen.has(varietalId)) continue;
    seen.add(varietalId);
    db.run(
      'INSERT INTO "WineVarietal" (id, wineMasterId, varietalId, percentage) VALUES (?,?,?,?)',
      [newId(), wineMasterId, varietalId, v.percentage ?? null],
    );
  }
}

export interface CreateWineOptions {
  performedBy?: string | null;
  /** 'CREATE' | 'PUBLISH' | 'IMPORT' - recorded as the first audit entry. */
  action?: string;
}

export async function createWineMaster(
  input: WineWriteInput,
  options: CreateWineOptions = {},
): Promise<{ wine: DbWineMaster | null; error?: string }> {
  return withWriteLock((db) => {
    const master = execFirst(db, 'SELECT id, code, name FROM "MasterItem" WHERE id = ? LIMIT 1', [input.masterItemId]);
    if (!master) return { wine: null, error: 'Master Item tidak ditemukan.' };

    const status: WineStatus = input.status === 'Inactive' ? 'Inactive' : 'Active';
    if (status === 'Active') {
      const linked = execFirst(
        db,
        `SELECT id FROM "WineMaster" WHERE masterItemId = ? AND status = 'Active' LIMIT 1`,
        [input.masterItemId],
      );
      if (linked) return { wine: null, error: 'Master Item ini sudah terhubung dengan Wine List.' };
    }
    if (input.sourceRequestId) {
      const published = execFirst(
        db,
        'SELECT id FROM "WineMaster" WHERE sourceRequestId = ? LIMIT 1',
        [input.sourceRequestId],
      );
      if (published) return { wine: null, error: 'Request ini sudah pernah dipublikasikan.' };
    }

    const id = newId();
    const now = nowIso();
    const columns = [
      'id', 'masterItemId', 'masterItemCode', 'masterItemName', 'sourceRequestId', 'legacyWineCode',
      'importBatchId', 'wineName', 'normalizedName', 'displayName', 'producerId', 'countryId',
      'regionId', 'appellationId', 'classificationId', 'wineTypeId', 'categoryId', 'subCategory1Id',
      'subCategory2Id', 'bottleSizeId', 'vintage', 'isNonVintage', 'abv', 'description',
      'tastingNotes', 'foodPairing', 'servingTemperature', 'internalNotes', 'costPerBottle',
      'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
    ];
    const values: unknown[] = [
      id, input.masterItemId, normStr(master.code), normStr(master.name),
      input.sourceRequestId ?? null, input.legacyWineCode ?? null, input.importBatchId ?? null,
      input.wineName.trim(), normalizeWineText(input.wineName), input.displayName || null,
      input.producerId || null, input.countryId || null, input.regionId || null,
      input.appellationId || null, input.classificationId || null, input.wineTypeId || null,
      input.categoryId || null, input.subCategory1Id || null, input.subCategory2Id || null,
      input.bottleSizeId || null, input.vintage ?? null, input.isNonVintage ? 1 : 0,
      input.abv ?? null, input.description || null, input.tastingNotes || null,
      input.foodPairing || null, input.servingTemperature || null, input.internalNotes || null,
      input.costPerBottle ?? null, status, now, options.performedBy ?? null, now,
      options.performedBy ?? null,
    ];
    db.run(
      `INSERT INTO "WineMaster" (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${columns.map(() => '?').join(',')})`,
      values,
    );
    replaceVarietals(db, id, input.varietals ?? []);
    writeAudit(db, [{
      wineMasterId: id,
      action: options.action ?? 'CREATE',
      fieldName: null,
      newValue: input.wineName.trim(),
      performedBy: options.performedBy ?? null,
      performedAt: now,
    }]);
    const row = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ?', [id]);
    return { wine: row ? rowToWineMaster(row) : null };
  });
}

export async function updateWineMaster(
  id: string,
  input: Partial<WineWriteInput>,
  options: { performedBy?: string | null; expectedUpdatedAt?: string | null } = {},
): Promise<{ wine: DbWineMaster | null; error?: string; conflict?: boolean }> {
  return withWriteLock((db) => {
    const current = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ? LIMIT 1', [id]);
    if (!current) return { wine: null, error: 'Wine tidak ditemukan.' };

    // Edge case 15: two users editing the same wine. The client echoes back the updatedAt it loaded;
    // a mismatch means someone else saved in between, so we refuse rather than silently overwrite.
    if (options.expectedUpdatedAt && String(current.updatedAt) !== options.expectedUpdatedAt) {
      return {
        wine: null,
        conflict: true,
        error: 'Data wine ini sudah diubah oleh user lain. Muat ulang halaman sebelum menyimpan.',
      };
    }

    const now = nowIso();
    const sets: string[] = ['updatedAt = ?', 'updatedBy = ?'];
    const vals: unknown[] = [now, options.performedBy ?? null];
    const auditEntries: Parameters<typeof writeAudit>[1] = [];

    for (const field of WINE_WRITE_FIELDS) {
      if (!(field in input)) continue;
      const next = toDbValue(field, (input as Record<string, unknown>)[field]);
      const prev = field === 'isNonVintage' ? (normBool(current[field]) ? 1 : 0) : (current[field] ?? null);
      // Compare stringified so 2015 (number) vs "2015" (text from SQLite) isn't a phantom change.
      if (String(prev ?? '') === String(next ?? '')) continue;
      sets.push(`"${field}" = ?`);
      vals.push(next);
      if (field === 'wineName') {
        sets.push('normalizedName = ?');
        vals.push(normalizeWineText(String(next ?? '')));
      }
      auditEntries.push({
        wineMasterId: id,
        action: field === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
        fieldName: field,
        oldValue: field === 'isNonVintage' ? (prev ? 'Yes' : 'No') : prev,
        newValue: field === 'isNonVintage' ? (next ? 'Yes' : 'No') : next,
        performedBy: options.performedBy ?? null,
        performedAt: now,
      });
    }

    // Re-activating must not create a second active Wine Master for one Master Item (rule 2).
    if (input.status === 'Active' && String(current.status) !== 'Active') {
      const linked = execFirst(
        db,
        `SELECT id FROM "WineMaster" WHERE masterItemId = ? AND status = 'Active' AND id <> ? LIMIT 1`,
        [String(current.masterItemId), id],
      );
      if (linked) return { wine: null, error: 'Master Item ini sudah terhubung dengan Wine List.' };
    }

    if (input.varietals) {
      const before = execAll(
        db,
        `SELECT COALESCE(d.name, wv.varietalId) AS name FROM "WineVarietal" wv
           LEFT JOIN "WineMasterData" d ON d.id = wv.varietalId
          WHERE wv.wineMasterId = ? ORDER BY name ASC`,
        [id],
      ).map((r) => String(r.name)).join(', ');
      replaceVarietals(db, id, input.varietals);
      const after = execAll(
        db,
        `SELECT COALESCE(d.name, wv.varietalId) AS name FROM "WineVarietal" wv
           LEFT JOIN "WineMasterData" d ON d.id = wv.varietalId
          WHERE wv.wineMasterId = ? ORDER BY name ASC`,
        [id],
      ).map((r) => String(r.name)).join(', ');
      if (before !== after) {
        auditEntries.push({
          wineMasterId: id, action: 'UPDATE', fieldName: 'varietals',
          oldValue: before, newValue: after,
          performedBy: options.performedBy ?? null, performedAt: now,
        });
      }
    }

    if (sets.length > 2 || auditEntries.length > 0) {
      vals.push(id);
      db.run(`UPDATE "WineMaster" SET ${sets.join(', ')} WHERE id = ?`, vals);
      writeAudit(db, auditEntries);
    }

    const row = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ?', [id]);
    return { wine: row ? rowToWineMaster(row) : null };
  });
}

/**
 * Status-only transition. Separate from updateWineMaster so the audit entry reads as a deliberate
 * status change and so the CHANGE_STATUS permission can gate it independently of EDIT.
 * There is no delete path anywhere in this module (rule 15).
 */
export async function setWineMasterStatus(
  id: string,
  status: WineStatus,
  options: { performedBy?: string | null; reason?: string | null } = {},
): Promise<{ wine: DbWineMaster | null; error?: string }> {
  return withWriteLock((db) => {
    const current = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ? LIMIT 1', [id]);
    if (!current) return { wine: null, error: 'Wine tidak ditemukan.' };
    const prev = String(current.status ?? 'Active');
    if (prev === status) return { wine: rowToWineMaster(current) };
    if (status === 'Active') {
      const linked = execFirst(
        db,
        `SELECT id FROM "WineMaster" WHERE masterItemId = ? AND status = 'Active' AND id <> ? LIMIT 1`,
        [String(current.masterItemId), id],
      );
      if (linked) return { wine: null, error: 'Master Item ini sudah terhubung dengan Wine List.' };
    }
    const now = nowIso();
    db.run('UPDATE "WineMaster" SET status = ?, updatedAt = ?, updatedBy = ? WHERE id = ?',
      [status, now, options.performedBy ?? null, id]);
    writeAudit(db, [{
      wineMasterId: id, action: 'STATUS_CHANGE', fieldName: 'status',
      oldValue: prev, newValue: options.reason ? `${status} (${options.reason})` : status,
      performedBy: options.performedBy ?? null, performedAt: now,
    }]);
    const row = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ?', [id]);
    return { wine: row ? rowToWineMaster(row) : null };
  });
}

// ── Master Item search (Add Wine step 1) ─────────────────────────────────────

export interface WineMasterItemCandidate extends DbMasterItem {
  /** id of the ACTIVE Wine Master already using this item, if any. */
  linkedWineId: string | null;
  linkedWineName: string | null;
}

export async function searchMasterItemsForWine(opts: {
  query?: string;
  outlet?: string;
  department?: string;
  category?: string;
  includeLinked?: boolean;
  limit?: number;
}): Promise<WineMasterItemCandidate[]> {
  try {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    const query = (opts.query ?? '').trim();
    if (query) {
      const like = `%${query}%`;
      conditions.push('(m.name LIKE ? OR m.code LIKE ? OR m.barcode LIKE ? OR m.plu LIKE ?)');
      params.push(like, like, like, like);
    }
    if (opts.department && opts.department !== 'ALL') { conditions.push('m.department = ?'); params.push(opts.department); }
    if (opts.category && opts.category !== 'ALL') { conditions.push('m.category = ?'); params.push(opts.category); }
    if (opts.outlet && opts.outlet !== 'ALL') {
      const code = opts.outlet;
      conditions.push('(m.outlets = ? OR m.outlets LIKE ? OR m.outlets LIKE ? OR m.outlets LIKE ?)');
      params.push(code, `${code};%`, `%;${code};%`, `%;${code}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
    const rows = execAll(
      db,
      `SELECT ${MASTER_JOIN_COLUMNS},
              lw.id AS linkedWineId, lw.wineName AS linkedWineName
         FROM "MasterItem" m
         LEFT JOIN "WineMaster" lw ON lw.masterItemId = m.id AND lw.status = 'Active'
       ${where}
       ORDER BY m.active DESC, m.name ASC
       LIMIT ?`,
      [...params, limit],
    );
    return rows
      .map((row) => {
        const master = rowToJoinedMaster(row);
        if (!master) return null;
        return {
          ...master,
          linkedWineId: normStr(row.linkedWineId),
          linkedWineName: normStr(row.linkedWineName),
        } as WineMasterItemCandidate;
      })
      .filter((c): c is WineMasterItemCandidate => c !== null)
      .filter((c) => (opts.includeLinked ? true : !c.linkedWineId));
  } catch (err) {
    console.error('[wineDb] searchMasterItemsForWine failed:', err);
    return [];
  }
}

/** Look up a master row by exact code or barcode - used by the import matcher. */
export async function findMasterItemsForImport(keys: {
  codes: string[];
  barcodes: string[];
}): Promise<{ byCode: Map<string, DbMasterItem>; byBarcode: Map<string, DbMasterItem[]> }> {
  const byCode = new Map<string, DbMasterItem>();
  const byBarcode = new Map<string, DbMasterItem[]>();
  try {
    const db = await getDb();
    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };
    const codes = Array.from(new Set(keys.codes.filter(Boolean)));
    for (const slice of chunk(codes, 400)) {
      const rows = execAll(
        db,
        `SELECT ${MASTER_JOIN_COLUMNS} FROM "MasterItem" m WHERE m.code IN (${slice.map(() => '?').join(',')})`,
        slice,
      );
      for (const row of rows) {
        const master = rowToJoinedMaster(row);
        if (master) byCode.set(master.code, master);
      }
    }
    const barcodes = Array.from(new Set(keys.barcodes.filter(Boolean).map((b) => b.toLowerCase())));
    for (const slice of chunk(barcodes, 400)) {
      const rows = execAll(
        db,
        `SELECT ${MASTER_JOIN_COLUMNS} FROM "MasterItem" m
          WHERE LOWER(TRIM(COALESCE(m.barcode,''))) IN (${slice.map(() => '?').join(',')})`,
        slice,
      );
      for (const row of rows) {
        const master = rowToJoinedMaster(row);
        if (!master) continue;
        const key = String(master.barcode ?? '').trim().toLowerCase();
        const list = byBarcode.get(key) ?? [];
        list.push(master);
        byBarcode.set(key, list);
      }
    }
  } catch (err) {
    console.error('[wineDb] findMasterItemsForImport failed:', err);
  }
  return { byCode, byBarcode };
}

// ── Pending publication ──────────────────────────────────────────────────────

export interface PendingPublicationRow {
  requestId: string;
  itemName: string;
  code: string | null;
  barcode: string | null;
  category: string;
  department: string;
  price: number | null;
  outlets: string;
  requestorName: string | null;
  requestorOutlet: string | null;
  completedAt: string | null;
  /** Resolved MasterItem for the request's PLU code - required before publishing. */
  masterItemId: string | null;
  masterItemName: string | null;
  masterItemActive: boolean | null;
}

/**
 * DONE wine requests that are not yet published. A request only becomes publishable once its PLU
 * code exists in the Master Item registry (edge case 1: DONE but not yet imported into Quinos) -
 * unresolved rows are still returned, flagged with masterItemId = null, so the wine team can see
 * why they cannot publish yet.
 */
export async function getPendingPublicationRequests(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: PendingPublicationRow[]; total: number }> {
  try {
    const db = await getDb();
    const conditions = [
      "r.status = 'DONE'",
      "(UPPER(r.department) LIKE '%WINE%' OR UPPER(r.category) LIKE '%WINE%')",
      'COALESCE(r.publishedToWineList, 0) = 0',
      'NOT EXISTS (SELECT 1 FROM "WineMaster" w WHERE w.sourceRequestId = r.id)',
    ];
    const params: unknown[] = [];
    if (opts.search && opts.search.trim()) {
      const q = `%${opts.search.trim()}%`;
      conditions.push('(r.name LIKE ? OR r.code LIKE ? OR r.barcode LIKE ? OR r.id LIKE ?)');
      params.push(q, q, q, q);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);

    const countRow = execFirst(db, `SELECT COUNT(*) AS cnt FROM "PLURequest" r ${where}`, params);
    const rows = execAll(
      db,
      `SELECT r.id, r.name, r.code, r.barcode, r.confirmedBarcode, r.category, r.department,
              r.price, r.outlets, r.doneAt, r.updatedAt,
              u.name AS requestorName, u.outlet AS requestorOutlet,
              m.id AS masterItemId, m.name AS masterItemName, m.active AS masterItemActive
         FROM "PLURequest" r
         LEFT JOIN "User" u ON u.id = r.userId
         LEFT JOIN "MasterItem" m ON m.code = r.code
       ${where}
       ORDER BY COALESCE(r.doneAt, r.updatedAt) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      total: countRow ? Number(countRow.cnt) : 0,
      rows: rows.map((row) => ({
        requestId: String(row.id),
        itemName: String(row.name ?? ''),
        code: normStr(row.code),
        // Cost Control's confirmed barcode wins over the cashier's original entry.
        barcode: normStr(row.confirmedBarcode) ?? normStr(row.barcode),
        category: String(row.category ?? ''),
        department: String(row.department ?? ''),
        price: row.price != null ? Number(row.price) : null,
        outlets: String(row.outlets ?? ''),
        requestorName: normStr(row.requestorName),
        requestorOutlet: normStr(row.requestorOutlet),
        completedAt: normStr(row.doneAt) ?? normStr(row.updatedAt),
        masterItemId: normStr(row.masterItemId),
        masterItemName: normStr(row.masterItemName),
        masterItemActive: row.masterItemActive == null ? null : normBool(row.masterItemActive),
      })),
    };
  } catch (err) {
    console.error('[wineDb] getPendingPublicationRequests failed:', err);
    throw err;
  }
}

export async function getPendingPublicationRequest(requestId: string): Promise<PendingPublicationRow | null> {
  try {
    const db = await getDb();
    const row = execFirst(
      db,
      `SELECT r.id, r.name, r.code, r.barcode, r.confirmedBarcode, r.category, r.department,
              r.price, r.outlets, r.doneAt, r.updatedAt, r.status,
              COALESCE(r.publishedToWineList, 0) AS publishedToWineList,
              u.name AS requestorName, u.outlet AS requestorOutlet,
              m.id AS masterItemId, m.name AS masterItemName, m.active AS masterItemActive
         FROM "PLURequest" r
         LEFT JOIN "User" u ON u.id = r.userId
         LEFT JOIN "MasterItem" m ON m.code = r.code
        WHERE r.id = ? LIMIT 1`,
      [requestId],
    );
    if (!row) return null;
    return {
      requestId: String(row.id),
      itemName: String(row.name ?? ''),
      code: normStr(row.code),
      barcode: normStr(row.confirmedBarcode) ?? normStr(row.barcode),
      category: String(row.category ?? ''),
      department: String(row.department ?? ''),
      price: row.price != null ? Number(row.price) : null,
      outlets: String(row.outlets ?? ''),
      requestorName: normStr(row.requestorName),
      requestorOutlet: normStr(row.requestorOutlet),
      completedAt: normStr(row.doneAt) ?? normStr(row.updatedAt),
      masterItemId: normStr(row.masterItemId),
      masterItemName: normStr(row.masterItemName),
      masterItemActive: row.masterItemActive == null ? null : normBool(row.masterItemActive),
    };
  } catch (err) {
    console.error('[wineDb] getPendingPublicationRequest failed:', err);
    return null;
  }
}

/**
 * Create a Wine Master from a DONE request and stamp the request as published, in one write so the
 * two can never disagree. sourceRequestId is uniquely indexed, so a double-click or a concurrent
 * publish loses the race cleanly instead of producing two wines.
 */
export async function publishRequestToWineList(
  requestId: string,
  input: Omit<WineWriteInput, 'sourceRequestId'>,
  options: { performedBy?: string | null; performedByName?: string | null } = {},
): Promise<{ wine: DbWineMaster | null; error?: string }> {
  return withWriteLock((db) => {
    const request = execFirst(
      db,
      `SELECT id, status, COALESCE(publishedToWineList,0) AS publishedToWineList
         FROM "PLURequest" WHERE id = ? LIMIT 1`,
      [requestId],
    );
    if (!request) return { wine: null, error: 'Request tidak ditemukan.' };
    if (String(request.status) !== 'DONE') {
      return { wine: null, error: 'Hanya request dengan status DONE yang dapat dipublikasikan.' };
    }
    if (normBool(request.publishedToWineList)) {
      return { wine: null, error: 'Request ini sudah pernah dipublikasikan.' };
    }
    const already = execFirst(db, 'SELECT id FROM "WineMaster" WHERE sourceRequestId = ? LIMIT 1', [requestId]);
    if (already) return { wine: null, error: 'Request ini sudah pernah dipublikasikan.' };

    const master = execFirst(db, 'SELECT id, code, name FROM "MasterItem" WHERE id = ? LIMIT 1', [input.masterItemId]);
    if (!master) return { wine: null, error: 'Master Item tidak ditemukan.' };
    const linked = execFirst(
      db,
      `SELECT id FROM "WineMaster" WHERE masterItemId = ? AND status = 'Active' LIMIT 1`,
      [input.masterItemId],
    );
    if (linked) return { wine: null, error: 'Master Item ini sudah terhubung dengan Wine List.' };

    const id = newId();
    const now = nowIso();
    db.run(
      `INSERT INTO "WineMaster" (
         id, masterItemId, masterItemCode, masterItemName, sourceRequestId, legacyWineCode,
         importBatchId, wineName, normalizedName, displayName, producerId, countryId, regionId,
         appellationId, classificationId, wineTypeId, categoryId, subCategory1Id, subCategory2Id,
         bottleSizeId, vintage, isNonVintage, abv, description, tastingNotes, foodPairing,
         servingTemperature, internalNotes, costPerBottle, status, createdAt, createdBy,
         updatedAt, updatedBy
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.masterItemId, normStr(master.code), normStr(master.name), requestId,
        input.legacyWineCode ?? null, null,
        input.wineName.trim(), normalizeWineText(input.wineName), input.displayName || null,
        input.producerId || null, input.countryId || null, input.regionId || null,
        input.appellationId || null, input.classificationId || null, input.wineTypeId || null,
        input.categoryId || null, input.subCategory1Id || null, input.subCategory2Id || null,
        input.bottleSizeId || null, input.vintage ?? null, input.isNonVintage ? 1 : 0,
        input.abv ?? null, input.description || null, input.tastingNotes || null,
        input.foodPairing || null, input.servingTemperature || null, input.internalNotes || null,
        input.costPerBottle ?? null, input.status === 'Inactive' ? 'Inactive' : 'Active',
        now, options.performedBy ?? null, now, options.performedBy ?? null,
      ],
    );
    replaceVarietals(db, id, input.varietals ?? []);
    db.run(
      'UPDATE "PLURequest" SET publishedToWineList = 1, publishedAt = ?, publishedBy = ? WHERE id = ?',
      [now, options.performedBy ?? null, requestId],
    );
    writeAudit(db, [{
      wineMasterId: id, action: 'PUBLISH', fieldName: 'sourceRequestId',
      newValue: requestId, performedBy: options.performedBy ?? null, performedAt: now,
    }]);
    const row = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ?', [id]);
    return { wine: row ? rowToWineMaster(row) : null };
  });
}

// ── Import batches ───────────────────────────────────────────────────────────

/**
 * Build the three match indexes + the "already has an active wine" map the import planner needs.
 *
 * Loads the whole Master Item registry into memory, matching the existing batch-import pattern
 * (lib/itemMatch.ts / getAllMasterItemsForMatch): one pass beats 7k individual lookups on WASM SQLite.
 */
export async function buildWineImportLookup(): Promise<MasterLookup> {
  const db = await getDb();
  const byCode = new Map<string, MasterRef>();
  const byBarcode = new Map<string, MasterRef[]>();
  const byNormalizedName = new Map<string, MasterRef[]>();
  const activeWineByMasterId = new Map<string, string>();

  const rows = execAll(db, 'SELECT id, code, name, barcode FROM "MasterItem"');
  for (const row of rows) {
    const ref: MasterRef = { id: String(row.id), code: String(row.code ?? ''), name: String(row.name ?? '') };
    if (ref.code) byCode.set(ref.code, ref);
    const barcode = String(row.barcode ?? '').trim().toLowerCase();
    if (barcode) {
      const list = byBarcode.get(barcode) ?? [];
      list.push(ref);
      byBarcode.set(barcode, list);
    }
    const normalized = normalizeWineText(ref.name);
    if (normalized) {
      const list = byNormalizedName.get(normalized) ?? [];
      list.push(ref);
      byNormalizedName.set(normalized, list);
    }
  }

  const wines = execAll(db, `SELECT id, masterItemId FROM "WineMaster" WHERE status = 'Active'`);
  for (const wine of wines) {
    activeWineByMasterId.set(String(wine.masterItemId), String(wine.id));
  }

  return { byCode, byBarcode, byNormalizedName, activeWineByMasterId };
}

export interface WineImportExecuteRow {
  rowNumber: number;
  masterItemId: string;
  masterItemCode: string | null;
  masterItemName: string | null;
  existingWineId: string | null;
  legacyWineCode: string | null;
  wineName: string;
  producerId: string | null;
  countryId: string | null;
  regionId: string | null;
  appellationId: string | null;
  classificationId: string | null;
  wineTypeId: string | null;
  categoryId: string | null;
  subCategory1Id: string | null;
  subCategory2Id: string | null;
  bottleSizeId: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  abv: number | null;
  costPerBottle: number | null;
  status: WineStatus;
  varietalIds: string[];
}

/**
 * Apply an import plan in one write pass.
 *
 * An UPDATE only fills fields the import actually carries - a blank cell in the legacy file never
 * wipes data a human already curated in the portal. Every touched wine gets an IMPORT audit entry, and
 * created rows carry importBatchId so the batch can be rolled back.
 */
export async function executeWineImportRows(
  batchId: string,
  rows: WineImportExecuteRow[],
  options: { performedBy?: string | null } = {},
): Promise<{ created: number; updated: number; failed: { rowNumber: number; error: string }[] }> {
  return withWriteLock((db) => {
    let created = 0;
    let updated = 0;
    const failed: { rowNumber: number; error: string }[] = [];
    const now = nowIso();
    const performedBy = options.performedBy ?? null;

    const REF_FIELDS = [
      'producerId', 'countryId', 'regionId', 'appellationId', 'classificationId', 'wineTypeId',
      'categoryId', 'subCategory1Id', 'subCategory2Id', 'bottleSizeId',
    ] as const;

    for (const row of rows) {
      try {
        if (row.existingWineId) {
          const current = execFirst(db, 'SELECT * FROM "WineMaster" WHERE id = ? LIMIT 1', [row.existingWineId]);
          if (!current) {
            failed.push({ rowNumber: row.rowNumber, error: 'Wine Master target tidak ditemukan.' });
            continue;
          }
          const sets: string[] = ['updatedAt = ?', 'updatedBy = ?'];
          const vals: unknown[] = [now, performedBy];
          const changed: string[] = [];

          const assign = (field: string, next: unknown) => {
            if (next == null || next === '') return; // never blank out curated data
            if (String(current[field] ?? '') === String(next)) return;
            sets.push(`"${field}" = ?`);
            vals.push(next);
            changed.push(field);
          };
          assign('wineName', row.wineName);
          if (row.wineName && String(current.wineName ?? '') !== row.wineName) {
            sets.push('normalizedName = ?');
            vals.push(normalizeWineText(row.wineName));
          }
          for (const field of REF_FIELDS) assign(field, row[field]);
          assign('legacyWineCode', row.legacyWineCode);
          assign('abv', row.abv);
          assign('costPerBottle', row.costPerBottle);
          // Vintage is only overwritten when the file actually carries one.
          if (row.vintage != null && Number(current.vintage ?? -1) !== row.vintage) {
            sets.push('vintage = ?', 'isNonVintage = ?');
            vals.push(row.vintage, 0);
            changed.push('vintage');
          } else if (row.isNonVintage && !normBool(current.isNonVintage) && current.vintage == null) {
            sets.push('isNonVintage = ?');
            vals.push(1);
            changed.push('isNonVintage');
          }

          vals.push(row.existingWineId);
          db.run(`UPDATE "WineMaster" SET ${sets.join(', ')} WHERE id = ?`, vals);

          if (row.varietalIds.length > 0) {
            replaceVarietals(db, row.existingWineId, row.varietalIds.map((varietalId) => ({ varietalId })));
            changed.push('varietals');
          }
          writeAudit(db, [{
            wineMasterId: row.existingWineId,
            action: 'IMPORT',
            fieldName: changed.length > 0 ? changed.join(', ') : null,
            newValue: `Import batch ${batchId}`,
            performedBy,
            performedAt: now,
          }]);
          updated += 1;
          continue;
        }

        // Guard against a race: another request may have created an active wine for this master
        // between planning and execution.
        const linked = execFirst(
          db,
          `SELECT id FROM "WineMaster" WHERE masterItemId = ? AND status = 'Active' LIMIT 1`,
          [row.masterItemId],
        );
        if (linked && row.status === 'Active') {
          failed.push({
            rowNumber: row.rowNumber,
            error: 'Master Item ini sudah terhubung dengan Wine List.',
          });
          continue;
        }

        const id = newId();
        db.run(
          `INSERT INTO "WineMaster" (
             id, masterItemId, masterItemCode, masterItemName, sourceRequestId, legacyWineCode,
             importBatchId, wineName, normalizedName, displayName, producerId, countryId, regionId,
             appellationId, classificationId, wineTypeId, categoryId, subCategory1Id, subCategory2Id,
             bottleSizeId, vintage, isNonVintage, abv, description, tastingNotes, foodPairing,
             servingTemperature, internalNotes, costPerBottle, status, createdAt, createdBy,
             updatedAt, updatedBy
           ) VALUES (?,?,?,?,NULL,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,?,?,?,?,?,?)`,
          [
            id, row.masterItemId, row.masterItemCode, row.masterItemName,
            row.legacyWineCode, batchId,
            row.wineName, normalizeWineText(row.wineName),
            row.producerId, row.countryId, row.regionId, row.appellationId, row.classificationId,
            row.wineTypeId, row.categoryId, row.subCategory1Id, row.subCategory2Id, row.bottleSizeId,
            row.vintage, row.isNonVintage ? 1 : 0, row.abv,
            row.costPerBottle, row.status,
            // createdAt / updatedAt are written identically so rollback can tell an untouched
            // imported row from one edited afterwards.
            now, performedBy, now, performedBy,
          ],
        );
        if (row.varietalIds.length > 0) {
          replaceVarietals(db, id, row.varietalIds.map((varietalId) => ({ varietalId })));
        }
        writeAudit(db, [{
          wineMasterId: id, action: 'IMPORT', fieldName: null,
          newValue: `Import batch ${batchId}`, performedBy, performedAt: now,
        }]);
        created += 1;
      } catch (err) {
        failed.push({
          rowNumber: row.rowNumber,
          error: err instanceof Error ? err.message : 'Gagal menyimpan baris.',
        });
      }
    }

    return { created, updated, failed };
  });
}

export async function createWineImportBatch(input: {
  fileName: string;
  totalRows: number;
  uploadedBy?: string | null;
}): Promise<string> {
  return withWriteLock((db) => {
    const id = newId();
    db.run(
      `INSERT INTO "WineImportBatch" (id, fileName, totalRows, status, uploadedBy, uploadedAt)
       VALUES (?,?,?,'RUNNING',?,?)`,
      [id, input.fileName, input.totalRows, input.uploadedBy ?? null, nowIso()],
    );
    return id;
  });
}

export async function completeWineImportBatch(
  batchId: string,
  summary: {
    createdRows: number; updatedRows: number; duplicateRows: number; failedRows: number;
    skippedRows: number; matchedRows: number; unmatchedRows: number;
  },
  errors: Omit<DbWineImportError, 'id' | 'importBatchId' | 'createdAt'>[],
): Promise<DbWineImportBatch | null> {
  return withWriteLock((db) => {
    const now = nowIso();
    db.run(
      `UPDATE "WineImportBatch" SET createdRows = ?, updatedRows = ?, duplicateRows = ?,
         failedRows = ?, skippedRows = ?, matchedRows = ?, unmatchedRows = ?,
         status = 'COMPLETED', completedAt = ? WHERE id = ?`,
      [
        summary.createdRows, summary.updatedRows, summary.duplicateRows, summary.failedRows,
        summary.skippedRows, summary.matchedRows, summary.unmatchedRows, now, batchId,
      ],
    );
    for (const err of errors) {
      db.run(
        `INSERT INTO "WineImportError" (id, importBatchId, rowNumber, wineName, pluCode, barcode, error, recommendation, createdAt)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [newId(), batchId, err.rowNumber, err.wineName ?? null, err.pluCode ?? null,
          err.barcode ?? null, err.error, err.recommendation ?? null, now],
      );
    }
    const row = execFirst(db, 'SELECT * FROM "WineImportBatch" WHERE id = ?', [batchId]);
    return row ? rowToImportBatch(row) : null;
  });
}

export async function getWineImportBatch(batchId: string): Promise<DbWineImportBatch | null> {
  try {
    const db = await getDb();
    const row = execFirst(db, 'SELECT * FROM "WineImportBatch" WHERE id = ? LIMIT 1', [batchId]);
    return row ? rowToImportBatch(row) : null;
  } catch {
    return null;
  }
}

export async function getWineImportBatches(limit = 20): Promise<DbWineImportBatch[]> {
  try {
    const db = await getDb();
    const rows = execAll(db, 'SELECT * FROM "WineImportBatch" ORDER BY uploadedAt DESC LIMIT ?', [limit]);
    return rows.map(rowToImportBatch);
  } catch {
    return [];
  }
}

export async function getWineImportErrors(batchId: string): Promise<DbWineImportError[]> {
  try {
    const db = await getDb();
    const rows = execAll(
      db,
      'SELECT * FROM "WineImportError" WHERE importBatchId = ? ORDER BY rowNumber ASC',
      [batchId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      importBatchId: String(r.importBatchId),
      rowNumber: Number(r.rowNumber),
      wineName: normStr(r.wineName),
      pluCode: normStr(r.pluCode),
      barcode: normStr(r.barcode),
      error: String(r.error),
      recommendation: normStr(r.recommendation),
      createdAt: String(r.createdAt),
    }));
  } catch {
    return [];
  }
}

export interface WineRollbackResult {
  ok: boolean;
  error?: string;
  removed: number;
  keptModified: number;
}

/**
 * Undo an import. Only rows still untouched since the import are removed: a wine whose updatedAt has
 * moved past its createdAt has been curated by hand since, and deleting it would destroy real work,
 * so it is kept and reported back as `keptModified`. Wines are hard-deleted here (with their audit
 * trail) because an import batch is a bulk mistake being reversed, not a business retirement -
 * rule 15's "never delete" governs the wine lifecycle, not a rolled-back import.
 */
export async function rollbackWineImportBatch(
  batchId: string,
  options: { performedBy?: string | null } = {},
): Promise<WineRollbackResult> {
  return withWriteLock((db) => {
    const batch = execFirst(db, 'SELECT * FROM "WineImportBatch" WHERE id = ? LIMIT 1', [batchId]);
    if (!batch) return { ok: false, error: 'Import batch tidak ditemukan.', removed: 0, keptModified: 0 };
    if (batch.rolledBackAt) {
      return { ok: false, error: 'Import batch ini sudah pernah di-rollback.', removed: 0, keptModified: 0 };
    }
    const rows = execAll(
      db,
      'SELECT id, createdAt, updatedAt FROM "WineMaster" WHERE importBatchId = ?',
      [batchId],
    );
    let removed = 0;
    let keptModified = 0;
    for (const row of rows) {
      const id = String(row.id);
      if (String(row.updatedAt) !== String(row.createdAt)) { keptModified += 1; continue; }
      db.run('DELETE FROM "WineVarietal" WHERE wineMasterId = ?', [id]);
      db.run('DELETE FROM "WineAuditLog" WHERE wineMasterId = ?', [id]);
      db.run('DELETE FROM "WineMaster" WHERE id = ?', [id]);
      removed += 1;
    }
    db.run(
      "UPDATE \"WineImportBatch\" SET status = 'ROLLED_BACK', rolledBackAt = ?, rolledBackBy = ? WHERE id = ?",
      [nowIso(), options.performedBy ?? null, batchId],
    );
    return { ok: true, removed, keptModified };
  });
}
