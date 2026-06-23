// Server-side reconciliation logic for the Reconcile module (/admin/kb/reconcile).
//
// All matching now runs here (previously client-side in page.tsx). Pure functions
// only — no DB import — so the upload route feeds in the master + bridge refs and
// the cascade is unit-testable. The route persists the outcomes into ReconcileRow.
//
// Physical stock codes come in two shapes that need different paths to a Quinos
// master barcode:
//   - SAP_7  : 7-digit SAP item number. Its NCK barcode is digits + "11".
//   - XEVLA_6: 6-digit XEVLA code. Resolved to a SAP code via the Master-sheet
//              bridge, then to an NCK barcode.
// See the cascade below for the full resolution order.

import { deriveNckBarcode } from '@/lib/barcode';
import { diceCoefficient } from '@/lib/itemMatch';
import type { ReconcileRowFilters } from '@/lib/db'; // type-only — erased at runtime, keeps this module DB-free

export type CodeType = 'SAP_7' | 'XEVLA_6' | 'OTHER';
export type MatchConfidence = 'EXACT' | 'FUZZY' | 'UNMATCHED';
export type MatchMethod =
  | 'BARCODE_DIRECT'   // fisikCode === master.barcode
  | 'SAP_NCK_DERIVED'  // SAP_7 → digits+11 === master.barcode
  | 'XEVLA_BRIDGE'     // XEVLA_6 → bridge → SAP → digits+11 === master.barcode
  | 'SAP_PREFIX'       // SAP_7 → some master.barcode starts with the SAP digits
  | 'NAME_FUZZY'       // bidirectional name includes()
  | 'NONE';            // unmatched

// ── Parsed inputs ────────────────────────────────────────────────────────────

export interface ParsedFisikRow {
  fisikCode: string;
  fisikName: string;
  fisikPrice: number | null;
  fisikQty: number | null;
  codeType: CodeType;
}

// One Master-sheet bridge entry linking a SAP item number to its XEVLA code and
// derived NCK barcode.
export interface BridgeEntry {
  sapCode: string;
  xevlaCode: string | null;
  nckBarcode: string | null;
  itemName: string;
}

// Minimal master shape the cascade needs.
export interface ReconcileMasterRef {
  code: string;
  name: string;
  price: number | null;
  barcode: string | null;
}

export interface MatchOutcome {
  matchedMasterCode: string | null;
  matchedMasterName: string | null;
  matchedMasterPrice: number | null;
  matchConfidence: MatchConfidence;
  matchMethod: MatchMethod;
  priceMatch: boolean | null;
}

// ── Code shape detection ─────────────────────────────────────────────────────

// 7-digit numeric → SAP_7; 6-digit numeric → XEVLA_6; anything else → OTHER.
export function detectCodeType(code: string): CodeType {
  const t = code.trim();
  if (/^\d{7}$/.test(t)) return 'SAP_7';
  if (/^\d{6}$/.test(t)) return 'XEVLA_6';
  return 'OTHER';
}

// Same NCK rule the wine cross-check uses: digits-only + "11" (e.g. "3010004" →
// "301000411"). Re-exported from lib/barcode so there is a single implementation.
export { deriveNckBarcode };

// A real physical item code: alphanumeric with at least one digit. Skips category
// header rows like "Australia" and dashed labels like "1-1". (Copied verbatim from
// the previous client-side parser so row inclusion is unchanged.)
export function isItemCode(code: string): boolean {
  return /^[A-Za-z0-9]+$/.test(code) && /\d/.test(code);
}

// Bidirectional, case-insensitive substring name match — identical semantics to
// the previous client-side nameContains.
export function nameContains(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

// Barcode comparison key: case-insensitive, surrounding/inner whitespace stripped.
function barcodeKey(v: string | null | undefined): string {
  return (v ?? '').toLowerCase().replace(/\s+/g, '');
}

// ── Cascade ──────────────────────────────────────────────────────────────────

export interface MatchContext {
  masters: ReconcileMasterRef[];
  // master.barcode (normalized) → master. First master wins on duplicate barcodes.
  barcodeMap: Map<string, ReconcileMasterRef>;
  // xevlaCode → bridge entry.
  xevlaMap: Map<string, BridgeEntry>;
}

export function buildMatchContext(masters: ReconcileMasterRef[], bridge: BridgeEntry[]): MatchContext {
  const barcodeMap = new Map<string, ReconcileMasterRef>();
  for (const m of masters) {
    const key = barcodeKey(m.barcode);
    if (key && !barcodeMap.has(key)) barcodeMap.set(key, m);
  }
  const xevlaMap = new Map<string, BridgeEntry>();
  for (const b of bridge) {
    if (b.xevlaCode) {
      const key = b.xevlaCode.trim();
      if (key && !xevlaMap.has(key)) xevlaMap.set(key, b);
    }
  }
  return { masters, barcodeMap, xevlaMap };
}

function outcome(
  m: ReconcileMasterRef, confidence: MatchConfidence, method: MatchMethod, fisikPrice: number | null,
): MatchOutcome {
  return {
    matchedMasterCode: m.code,
    matchedMasterName: m.name,
    matchedMasterPrice: m.price,
    matchConfidence: confidence,
    matchMethod: method,
    // priceMatch is meaningful only when both sides carry a price.
    priceMatch: fisikPrice != null && m.price != null ? fisikPrice === m.price : false,
  };
}

const UNMATCHED: MatchOutcome = {
  matchedMasterCode: null, matchedMasterName: null, matchedMasterPrice: null,
  matchConfidence: 'UNMATCHED', matchMethod: 'NONE', priceMatch: null,
};

// Resolve a single physical row to a master following the fixed cascade; stops at
// the first hit. Steps that don't apply to the row's codeType are skipped.
export function matchFisikRow(row: ParsedFisikRow, ctx: MatchContext): MatchOutcome {
  // 1. Direct barcode hit (fisik code already equals a master barcode).
  const direct = ctx.barcodeMap.get(barcodeKey(row.fisikCode));
  if (direct) return outcome(direct, 'EXACT', 'BARCODE_DIRECT', row.fisikPrice);

  // 2. SAP_7 → derive NCK barcode (digits + 11).
  if (row.codeType === 'SAP_7') {
    const nck = ctx.barcodeMap.get(barcodeKey(deriveNckBarcode(row.fisikCode)));
    if (nck) return outcome(nck, 'EXACT', 'SAP_NCK_DERIVED', row.fisikPrice);
  }

  // 3. XEVLA_6 → bridge → SAP → derive NCK barcode.
  if (row.codeType === 'XEVLA_6') {
    const b = ctx.xevlaMap.get(row.fisikCode.trim());
    if (b?.sapCode) {
      const nck = ctx.barcodeMap.get(barcodeKey(deriveNckBarcode(b.sapCode)));
      if (nck) return outcome(nck, 'EXACT', 'XEVLA_BRIDGE', row.fisikPrice);
    }
  }

  // 4. SAP_7 → some master barcode begins with the raw SAP digits (no +11 suffix).
  if (row.codeType === 'SAP_7') {
    const digits = barcodeKey(row.fisikCode);
    const prefix = ctx.masters.find((m) => barcodeKey(m.barcode).startsWith(digits) && digits.length > 0);
    if (prefix) return outcome(prefix, 'EXACT', 'SAP_PREFIX', row.fisikPrice);
  }

  // 5. Fuzzy name match (bidirectional includes).
  const fuzzy = ctx.masters.find((m) => nameContains(m.name, row.fisikName));
  if (fuzzy) return outcome(fuzzy, 'FUZZY', 'NAME_FUZZY', row.fisikPrice);

  // 6. No match.
  return { ...UNMATCHED };
}

// Shared query-string → filter parsing for the rows and export routes so both
// reflect the same view. Only recognized values pass through; junk is ignored.
export function parseReconcileRowFilters(params: URLSearchParams): ReconcileRowFilters {
  const f: ReconcileRowFilters = {};
  const tab = params.get('tab');
  if (tab === 'matched' || tab === 'not_in_cloud' || tab === 'not_in_fisik') f.tab = tab;
  const confidence = params.get('confidence');
  if (confidence === 'EXACT' || confidence === 'FUZZY' || confidence === 'UNMATCHED') f.confidence = confidence;
  const priceMatch = params.get('priceMatch');
  if (priceMatch === 'true') f.priceMatch = true;
  else if (priceMatch === 'false') f.priceMatch = false;
  const codeType = params.get('codeType');
  if (codeType === 'SAP_7' || codeType === 'XEVLA_6' || codeType === 'OTHER') f.codeType = codeType;
  const subGroup = params.get('subGroup');
  if (subGroup) f.subGroup = subGroup;
  const min = params.get('priceDiffMin');
  if (min != null && min !== '' && Number.isFinite(Number(min))) f.priceDiffMin = Number(min);
  const max = params.get('priceDiffMax');
  if (max != null && max !== '' && Number.isFinite(Number(max))) f.priceDiffMax = Number(max);
  const search = params.get('search');
  if (search) f.search = search;
  return f;
}

// Best name-similarity candidate among masters for an unmatched row — used to
// annotate the "Tidak di Cloud" export so the admin has a lead to investigate.
export function bestFuzzyCandidate(
  name: string, masters: ReconcileMasterRef[],
): { name: string; score: number } | null {
  let best: { name: string; score: number } | null = null;
  for (const m of masters) {
    const score = diceCoefficient(name, m.name);
    if (!best || score > best.score) best = { name: m.name, score };
  }
  return best;
}
