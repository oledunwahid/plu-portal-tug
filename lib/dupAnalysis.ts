// Master Item duplicate analysis with SAP cross-evidence.
//
// This is an EVIDENCE + REVIEW tool. It never mutates data. It groups MasterItem
// rows that look duplicated, then cross-references SapMasterItem to decide whether
// an apparent duplicate is:
//   - a real MasterItem duplicate that should be merged/removed (LIKELY_DUPLICATE),
//   - an expected separation caused by SAP structure — different itemNo / NCK /
//     size / bottle-vs-glass (SAP_SEPARATED),
//   - ambiguous / needs a human (AMBIGUOUS),
//   - or lacking any SAP row to compare against (NO_SAP_EVIDENCE).
//
// Pure functions only (no DB import) so the heavy fuzzy matching can be unit
// tested and run server-side; the API route feeds in the two registries.

import { normalizeText, diceCoefficient, tokenize } from './itemMatch';
import { isNckCode } from './barcode';

export type Classification =
  | 'LIKELY_DUPLICATE'
  | 'SAP_SEPARATED'
  | 'AMBIGUOUS'
  | 'NO_SAP_EVIDENCE';

export type RecommendedAction =
  | 'MERGE_OR_REMOVE'
  | 'KEEP_SEPARATE_SAP_EVIDENCE'
  | 'REVIEW_MANUALLY'
  | 'NEED_SAP_CHECK';

export type SapMatchReason =
  | 'exact-barcode'
  | 'exact-name'
  | 'fuzzy-name'
  | 'nck-related'
  | 'weak';

export interface DupMasterInput {
  id: string; code: string; name: string; category: string; department: string;
  price: number | null; barcode: string | null; outlets: string | null;
  outletGroup: string | null; folder: string | null;
}

export interface DupSapInput {
  itemNo: string; description: string; subGroup: string | null; barcode: string | null;
}

export interface SapMatch {
  itemNo: string; description: string; subGroup: string | null; barcode: string | null;
  score: number; reason: SapMatchReason; isNck: boolean; normalizedBase: string;
}

export interface DupGroup {
  id: string;
  classification: Classification;
  confidence: number;
  reason: string;
  recommendedAction: RecommendedAction;
  key: string;
  prefix: string;
  department: string;
  category: string;
  outlets: string[];
  price: number | null;
  masterItems: DupMasterInput[];
  sapMatches: SapMatch[];
  // Evidence flags surfaced to the UI.
  sizeDiff: boolean;
  typeDiff: boolean;
  nckVariance: boolean;
  distinctSapBases: number;
}

export interface DupFilters {
  department?: string;
  category?: string;
  outlet?: string;
  prefix?: string;
  search?: string;
  classification?: string;
  sort?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface DupFilterOptions {
  departments: string[];
  categories: string[];
  outlets: string[];
  prefixes: string[];
}

export interface DupCounts {
  total: number;
  likelyDuplicate: number;
  sapSeparated: number;
  ambiguous: number;
  noSapEvidence: number;
}

export interface DupAnalysisResult {
  groups: DupGroup[];
  counts: DupCounts;
  filterOptions: DupFilterOptions;
}

// ── Tuning knobs ─────────────────────────────────────────────────────────────
const MERGE_SIM = 0.72;    // fuzzy-union threshold to merge two base-name buckets
const FUZZY_MIN = 0.5;     // minimum SAP name similarity to count as a fuzzy match
const WEAK_MIN = 0.32;     // keep as weak evidence only
const STRONG_SIM = 0.7;    // SAP evidence considered strong at/above this
const INTRA_SIMILAR = 0.72;// members "look duplicated" at/above this pairwise sim
const INTRA_IDENTICAL = 0.9;
const MAX_SAP_MATCHES = 12;
const MAX_SAP_CANDIDATES = 1200; // guard against pathologically common tokens

// Size tokens: 750ml, 70cl, 1l, 700 ml, 40g …
const SIZE_SRC = '(\\d{1,4})\\s?(ml|cl|ltr|liter|litre|l|g|gr|gram|kg|oz)\\b';
// Bottle-vs-glass style tokens. Canonicalised so BT/BTL/BOTTLE → bottle and
// SG/GLS/GLASS/SHOT → glass (the classic "same wine, different serving" split).
const TYPE_MAP: Record<string, string> = {
  bt: 'bottle', btl: 'bottle', btg: 'bottle', bottle: 'bottle', botol: 'bottle',
  sg: 'glass', gls: 'glass', glass: 'glass', gelas: 'glass', shot: 'glass', byg: 'glass',
};

function digitsOnly(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function extractSizes(s: string): string[] {
  const out: string[] = [];
  const re = new RegExp(SIZE_SRC, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(`${m[1]}${m[2].toLowerCase()}`);
  return out;
}

// Canonical serving type detected in a name, or null.
function extractType(name: string): string | null {
  const toks = normalizeText(name).replace(/[^a-z0-9 ]/g, ' ').split(' ');
  for (const t of toks) if (TYPE_MAP[t]) return TYPE_MAP[t];
  return null;
}

// Grouping base name: normalized, with size / percent / serving-type tokens
// stripped so "1800 Anejo BT", "1800 Anejo SG" and "1800 Anejo 750ml" collapse.
function baseName(name: string): string {
  let s = normalizeText(name);
  s = s.replace(new RegExp(SIZE_SRC, 'gi'), ' ');
  s = s.replace(/\b\d{1,3}\s?%/g, ' ');
  s = s.replace(/[^a-z0-9 ]/g, ' ');
  const toks = s.split(' ').filter((t) => t && !TYPE_MAP[t]);
  return toks.join(' ').trim();
}

// SAP itemNo "2070176(NCK)" → digits base "2070176".
function sapBase(itemNo: string): string {
  return digitsOnly(itemNo.replace(/\(NCK\)/gi, ''));
}

function splitOutlets(field: string | null | undefined): string[] {
  return (field ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Union-find for fuzzy bucket merging ──────────────────────────────────────
class UF {
  private parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): void { this.parent[this.find(a)] = this.find(b); }
}

interface Bucket { key: string; base: string; prefix: string; dept: string; items: DupMasterInput[]; }

// Group master items into duplicate candidate groups (≥2 items) using
// prefix + department + base-name buckets, then a fuzzy union across buckets
// in the same prefix+department partition (merges brand variants like
// "1800 Anejo" and "Jose 1800 Anejo").
function buildBuckets(masters: DupMasterInput[]): Bucket[] {
  const byKey = new Map<string, Bucket>();
  for (const m of masters) {
    const base = baseName(m.name);
    if (!base) continue;
    const prefix = m.code.slice(0, 3);
    const dept = normalizeText(m.department);
    const key = `${prefix}|${dept}|${base}`;
    let b = byKey.get(key);
    if (!b) { b = { key, base, prefix, dept, items: [] }; byKey.set(key, b); }
    b.items.push(m);
  }

  const buckets = Array.from(byKey.values());

  // Partition buckets by prefix+dept, fuzzy-union within each partition.
  const partitions = new Map<string, number[]>();
  buckets.forEach((b, i) => {
    const pk = `${b.prefix}|${b.dept}`;
    const arr = partitions.get(pk);
    if (arr) arr.push(i); else partitions.set(pk, [i]);
  });

  const uf = new UF(buckets.length);
  for (const idxs of Array.from(partitions.values())) {
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        if (diceCoefficient(buckets[idxs[a]].base, buckets[idxs[b]].base) >= MERGE_SIM) {
          uf.union(idxs[a], idxs[b]);
        }
      }
    }
  }

  const merged = new Map<number, Bucket>();
  buckets.forEach((b, i) => {
    const root = uf.find(i);
    const target = merged.get(root);
    if (target) { target.items.push(...b.items); }
    else merged.set(root, { key: b.key, base: b.base, prefix: b.prefix, dept: b.dept, items: [...b.items] });
  });

  return Array.from(merged.values()).filter((b) => b.items.length >= 2);
}

// ── SAP evidence matching ────────────────────────────────────────────────────
interface SapIndex { saps: DupSapInput[]; tokenIndex: Map<string, number[]>; }

function buildSapIndex(saps: DupSapInput[]): SapIndex {
  const tokenIndex = new Map<string, number[]>();
  saps.forEach((s, i) => {
    for (const t of tokenize(s.description)) {
      const posting = tokenIndex.get(t);
      if (posting) posting.push(i); else tokenIndex.set(t, [i]);
    }
  });
  return { saps, tokenIndex };
}

function matchSapForGroup(items: DupMasterInput[], base: string, idx: SapIndex): SapMatch[] {
  // Candidate SAP rows share at least one token with a member name or the base.
  const candidateIdx = new Set<number>();
  const nameTokens = new Set<string>(tokenize(base));
  for (const it of items) for (const t of tokenize(it.name)) nameTokens.add(t);
  for (const t of Array.from(nameTokens)) {
    const posting = idx.tokenIndex.get(t);
    if (!posting) continue;
    for (const i of posting) {
      candidateIdx.add(i);
      if (candidateIdx.size >= MAX_SAP_CANDIDATES) break;
    }
    if (candidateIdx.size >= MAX_SAP_CANDIDATES) break;
  }

  const memberBarcodes = new Set<string>();
  for (const it of items) { const d = digitsOnly(it.barcode); if (d) memberBarcodes.add(d); }
  const memberNames = items.map((it) => normalizeText(it.name));

  const matches: SapMatch[] = [];
  candidateIdx.forEach((i) => {
    const sap = idx.saps[i];
    const isNck = isNckCode(sap.itemNo);
    const nb = sapBase(sap.itemNo);
    const sapBarcode = digitsOnly(sap.barcode);
    const nckBarcode = isNck && nb ? `${nb}11` : '';
    const descNorm = normalizeText(sap.description.replace(/\(NCK\)/gi, ''));

    // Barcode / itemNo exact evidence.
    const barcodeHit =
      (sapBarcode && memberBarcodes.has(sapBarcode)) ||
      (nb && memberBarcodes.has(nb)) ||
      (nckBarcode && memberBarcodes.has(nckBarcode));

    const nameHit = memberNames.some((n) => n && n === descNorm);

    let best = 0;
    for (const it of items) {
      const s = diceCoefficient(it.name, sap.description);
      if (s > best) best = s;
    }

    let reason: SapMatchReason;
    let score: number;
    if (barcodeHit) { reason = 'exact-barcode'; score = 1; }
    else if (nameHit) { reason = 'exact-name'; score = 0.98; }
    else if (best >= FUZZY_MIN) { reason = 'fuzzy-name'; score = best; }
    else if (isNck && best >= WEAK_MIN) { reason = 'nck-related'; score = best; }
    else if (best >= WEAK_MIN) { reason = 'weak'; score = best; }
    else return;

    matches.push({
      itemNo: sap.itemNo, description: sap.description, subGroup: sap.subGroup,
      barcode: sap.barcode, score: round2(score), reason, isNck, normalizedBase: nb,
    });
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, MAX_SAP_MATCHES);
}

// ── Classification ───────────────────────────────────────────────────────────
const ACTION: Record<Classification, RecommendedAction> = {
  LIKELY_DUPLICATE: 'MERGE_OR_REMOVE',
  SAP_SEPARATED: 'KEEP_SEPARATE_SAP_EVIDENCE',
  AMBIGUOUS: 'REVIEW_MANUALLY',
  NO_SAP_EVIDENCE: 'NEED_SAP_CHECK',
};

interface Classified {
  classification: Classification;
  confidence: number;
  reason: string;
  recommendedAction: RecommendedAction;
  sizeDiff: boolean;
  typeDiff: boolean;
  nckVariance: boolean;
  distinctSapBases: number;
}

function classifyGroup(items: DupMasterInput[], base: string, sapMatches: SapMatch[]): Classified {
  const meaningful = sapMatches.filter((m) => m.score >= FUZZY_MIN || m.reason === 'exact-barcode' || m.reason === 'exact-name');
  const bestScore = sapMatches.length ? sapMatches[0].score : 0;

  // Size evidence — from meaningful SAP descriptions and member names.
  const sizes = new Set<string>();
  for (const it of items) for (const z of extractSizes(it.name)) sizes.add(z);
  for (const m of meaningful) for (const z of extractSizes(m.description)) sizes.add(z);
  const sizeDiff = sizes.size > 1;

  // Serving-type evidence (bottle vs glass) — member-side signal.
  const types = new Set<string>();
  for (const it of items) { const t = extractType(it.name); if (t) types.add(t); }
  const typeDiff = types.size > 1;

  const bases = new Set<string>();
  let hasNck = false, hasNonNck = false;
  for (const m of meaningful) {
    if (m.normalizedBase) bases.add(m.normalizedBase);
    if (m.isNck) hasNck = true; else hasNonNck = true;
  }
  const distinctSapBases = bases.size;
  const nckVariance = hasNck && hasNonNck;

  const strongSap = meaningful.some((m) => m.score >= STRONG_SIM || m.reason === 'exact-barcode' || m.reason === 'exact-name');
  const sapSeparation = meaningful.length > 0 && (distinctSapBases >= 2 || sizeDiff || nckVariance);

  // Internal-duplicate signals.
  const barcodeDigits = items.map((it) => digitsOnly(it.barcode)).filter(Boolean);
  const barcodeCollision = new Set(barcodeDigits).size < barcodeDigits.length; // ≥2 share a barcode
  const cats = new Set(items.map((it) => normalizeText(it.category)));
  const depts = new Set(items.map((it) => normalizeText(it.department)));
  const prices = new Set(items.map((it) => it.price ?? -1));
  const sameKey = cats.size === 1 && depts.size === 1 && prices.size === 1;

  // Intra-group name similarity vs the base representative.
  let minSim = 1;
  for (const it of items) { const s = diceCoefficient(it.name, base); if (s < minSim) minSim = s; }
  const intraSimilar = minSim >= INTRA_SIMILAR;
  const intraIdentical = minSim >= INTRA_IDENTICAL;

  // ── Decision tree (SAP separation wins first) ──
  let classification: Classification;
  let confidence: number;

  if (sapSeparation && strongSap) {
    classification = 'SAP_SEPARATED';
    confidence = Math.min(0.98, 0.7 + 0.28 * bestScore + 0.05 * (distinctSapBases - 1));
  } else if (sapSeparation) {
    classification = 'AMBIGUOUS';
    confidence = 0.45 + 0.2 * bestScore;
  } else if (barcodeCollision && !typeDiff) {
    classification = 'LIKELY_DUPLICATE';
    confidence = 0.9;
  } else if (typeDiff) {
    classification = 'AMBIGUOUS';
    confidence = 0.5 + 0.15 * bestScore;
  } else if (sapMatches.length === 0) {
    if (intraIdentical && sameKey) {
      classification = 'LIKELY_DUPLICATE';
      confidence = 0.6 + 0.25 * minSim;
    } else {
      classification = 'NO_SAP_EVIDENCE';
      confidence = 0.3 + 0.2 * minSim;
    }
  } else if (intraSimilar && sameKey && meaningful.length > 0 && distinctSapBases <= 1) {
    classification = 'LIKELY_DUPLICATE';
    confidence = 0.65 + 0.3 * minSim;
  } else {
    classification = 'AMBIGUOUS';
    confidence = 0.4 + 0.2 * bestScore;
  }

  const reason = buildReason(classification, {
    meaningful, sizeDiff, typeDiff, nckVariance, distinctSapBases, barcodeCollision, sameKey,
  });

  return {
    classification,
    confidence: round2(Math.max(0, Math.min(1, confidence))),
    reason,
    recommendedAction: ACTION[classification],
    sizeDiff, typeDiff, nckVariance, distinctSapBases,
  };
}

function buildReason(
  classification: Classification,
  ctx: { meaningful: SapMatch[]; sizeDiff: boolean; typeDiff: boolean; nckVariance: boolean; distinctSapBases: number; barcodeCollision: boolean; sameKey: boolean },
): string {
  const diffs: string[] = [];
  if (ctx.nckVariance) diffs.push('NCK');
  if (ctx.sizeDiff) diffs.push('ukuran');
  if (ctx.typeDiff) diffs.push('tipe (BT/SG)');
  if (ctx.distinctSapBases >= 2) diffs.push('nomor item SAP');

  const sapList = ctx.meaningful.slice(0, 4).map((m) => m.itemNo).join(', ');
  const nMore = ctx.meaningful.length > 4 ? ` (+${ctx.meaningful.length - 4} lagi)` : '';

  switch (classification) {
    case 'SAP_SEPARATED':
      return `SAP punya ${ctx.meaningful.length} baris terkait: ${sapList}${nMore}.` +
        (diffs.length ? ` Perbedaan terdeteksi: ${diffs.join('/')}.` : '') +
        ' Kemungkinan bukan duplikat — pisahan mengikuti struktur SAP.';
    case 'AMBIGUOUS':
      return ctx.meaningful.length
        ? `Ada kecocokan SAP (${sapList}${nMore}) tapi bukti belum kuat` +
          (diffs.length ? ` — perbedaan: ${diffs.join('/')}.` : '.') + ' Perlu pengecekan manual.'
        : 'Perbedaan tipe/ukuran terdeteksi tanpa bukti SAP yang jelas. Perlu pengecekan manual.';
    case 'LIKELY_DUPLICATE':
      return 'Nama sangat mirip, department/kategori/harga sama' +
        (ctx.barcodeCollision ? ', barcode sama' : '') +
        '. Tidak ada bukti SAP yang memisahkan. Kemungkinan duplikat.';
    case 'NO_SAP_EVIDENCE':
    default:
      return 'Tidak ada baris SAP yang cocok untuk dibandingkan. Perlu pengecekan SAP manual.';
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

// Full analysis of every duplicate group with SAP evidence (unfiltered).
// Heavy: builds a SAP token index once and matches each group against it.
export function buildAllGroups(masters: DupMasterInput[], saps: DupSapInput[]): { groups: DupGroup[]; filterOptions: DupFilterOptions } {
  const buckets = buildBuckets(masters);
  const sapIndex = buildSapIndex(saps);

  const groups: DupGroup[] = buckets.map((b) => {
    const items = [...b.items].sort((a, c) => a.code.localeCompare(c.code));
    const sapMatches = matchSapForGroup(items, b.base, sapIndex);
    const cls = classifyGroup(items, b.base, sapMatches);
    const outlets = Array.from(new Set(items.flatMap((it) => splitOutlets(it.outlets)))).sort();
    return {
      id: items[0].id,
      classification: cls.classification,
      confidence: cls.confidence,
      reason: cls.reason,
      recommendedAction: cls.recommendedAction,
      key: b.key,
      prefix: b.prefix,
      department: items[0].department,
      category: items[0].category,
      outlets,
      price: items[0].price,
      masterItems: items,
      sapMatches,
      sizeDiff: cls.sizeDiff,
      typeDiff: cls.typeDiff,
      nckVariance: cls.nckVariance,
      distinctSapBases: cls.distinctSapBases,
    };
  });

  // Sort default: worst first (Likely Duplicate), then by confidence.
  const order: Record<Classification, number> = { LIKELY_DUPLICATE: 0, AMBIGUOUS: 1, NO_SAP_EVIDENCE: 2, SAP_SEPARATED: 3 };
  groups.sort((a, b) => (order[a.classification] - order[b.classification]) || (b.confidence - a.confidence));

  const departments = new Set<string>();
  const categories = new Set<string>();
  const outlets = new Set<string>();
  const prefixes = new Set<string>();
  for (const g of groups) {
    for (const it of g.masterItems) {
      if (it.department) departments.add(it.department);
      if (it.category) categories.add(it.category);
    }
    for (const o of g.outlets) outlets.add(o);
    if (g.prefix) prefixes.add(g.prefix);
  }
  const sortStr = (a: string, b: string) => a.localeCompare(b, 'id');

  return {
    groups,
    filterOptions: {
      departments: Array.from(departments).sort(sortStr),
      categories: Array.from(categories).sort(sortStr),
      outlets: Array.from(outlets).sort(sortStr),
      prefixes: Array.from(prefixes).sort(sortStr),
    },
  };
}

function matchesSearch(g: DupGroup, q: string): boolean {
  if (g.masterItems.some((it) =>
    it.code.toLowerCase().includes(q) ||
    it.name.toLowerCase().includes(q) ||
    (it.barcode ?? '').toLowerCase().includes(q) ||
    it.category.toLowerCase().includes(q) ||
    it.department.toLowerCase().includes(q))) return true;
  return g.sapMatches.some((m) =>
    m.itemNo.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
}

// Apply filters + sort to pre-built groups. Counts are computed BEFORE the
// classification filter so the classification chips reflect the current
// department/category/outlet/prefix/search/price selection.
export function applyFilters(groups: DupGroup[], f: DupFilters): { groups: DupGroup[]; counts: DupCounts } {
  const dept = f.department && f.department !== 'ALL' ? f.department : null;
  const cat = f.category && f.category !== 'ALL' ? f.category : null;
  const outlet = f.outlet && f.outlet !== 'ALL' ? f.outlet : null;
  const prefix = f.prefix && f.prefix !== 'ALL' ? f.prefix : null;
  const q = (f.search ?? '').trim().toLowerCase();
  const cls = f.classification && f.classification !== 'ALL' ? f.classification : null;

  const base = groups.filter((g) => {
    if (dept && !g.masterItems.some((it) => it.department === dept)) return false;
    if (cat && !g.masterItems.some((it) => it.category === cat)) return false;
    if (outlet && !g.outlets.includes(outlet)) return false;
    if (prefix && g.prefix !== prefix) return false;
    if (f.minPrice != null && (g.price == null || g.price < f.minPrice)) return false;
    if (f.maxPrice != null && (g.price == null || g.price > f.maxPrice)) return false;
    if (q && !matchesSearch(g, q)) return false;
    return true;
  });

  const counts: DupCounts = {
    total: base.length,
    likelyDuplicate: base.filter((g) => g.classification === 'LIKELY_DUPLICATE').length,
    sapSeparated: base.filter((g) => g.classification === 'SAP_SEPARATED').length,
    ambiguous: base.filter((g) => g.classification === 'AMBIGUOUS').length,
    noSapEvidence: base.filter((g) => g.classification === 'NO_SAP_EVIDENCE').length,
  };

  let out = cls ? base.filter((g) => g.classification === cls) : base;

  if (f.sort === 'prefix') out = [...out].sort((a, b) => a.prefix.localeCompare(b.prefix) || b.confidence - a.confidence);
  else if (f.sort === 'count') out = [...out].sort((a, b) => b.masterItems.length - a.masterItems.length);
  else if (f.sort === 'confidence') out = [...out].sort((a, b) => b.confidence - a.confidence);
  // default: already ordered worst-first by buildAllGroups

  return { groups: out, counts };
}

export function analyzeDuplicates(masters: DupMasterInput[], saps: DupSapInput[], filters: DupFilters = {}): DupAnalysisResult {
  const { groups, filterOptions } = buildAllGroups(masters, saps);
  const { groups: filtered, counts } = applyFilters(groups, filters);
  return { groups: filtered, counts, filterOptions };
}
