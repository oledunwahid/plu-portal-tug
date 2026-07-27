'use client';

import { useState, useEffect, useRef } from 'react';
import { ScanBarcode, Upload, Download, Loader2, CheckCircle2, GitCompareArrows } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { diceCoefficient, normalizeText } from '@/lib/itemMatch';
import { deriveNckBarcode } from '@/lib/barcode';
import { OUTLET_TO_GROUP } from '@/lib/outlets';

interface MasterItem {
  id: string; active: boolean; code: string; name: string;
  category: string; department: string; price: number | null;
  outlets: string | null; outletGroup: string | null;
  barcode: string | null; folder: string | null;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
}

function ItemCard({ item }: { item: MasterItem }) {
  const outlets = (item.outlets ?? '').split(/[;,]/).filter(Boolean);
  return (
    <div className="card" style={{ padding: '0.875rem 1.125rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{item.code}</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.category} · {item.department}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            {item.price != null ? formatPrice(item.price) : '—'}
          </div>
          <span style={{
            fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
            background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
            color: item.active ? '#2D4A2E' : '#7A2E1F',
            border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`
          }}>
            {item.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      {outlets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '0.5rem' }}>
          {outlets.map((o) => (
            <span key={o} style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o.trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Barcode Auto-Fill + Master Comparison ──────────────────────────────────
// Self-contained feature rendered below the search box. Parses three admin XLSX
// sources entirely client-side, derives missing barcodes from NCK SAP codes, and
// (separately) diffs the uploaded batch against the master registry. Reuses
// diceCoefficient + normalizeText (lib/itemMatch) and OUTLET_TO_GROUP (lib/outlets).
// The 18-column order mirrors the canonical TEMPLATE_HEADERS in lib/export.ts.

const BATCH_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef', 'Price', 'PLU', 'Barcode', 'UOM',
  'Folder', 'ServiceCharge', 'Tax1', 'Tax2', 'NoDiscount', 'HideReceipt', 'Printers', 'Outlets',
] as const;

const FUZZY_MIN = 0.45;
const HIGH_MIN = 0.80;
const MEDIUM_MIN = 0.60;

const CONFIRMED_UNRESOLVABLE = [
  "e- enrico serafino 'oudeis' millesimato brut 2022",
  'wom chateau beaumont',
];

interface CekRow { code: string; name: string; }
interface SapRow { itemNo: string; description: string; }

type StatusKind =
  | 'HIGH' | 'MEDIUM' | 'LOW'
  | 'ALREADY_BARCODE' | 'UNION_SKIP'
  | 'NO_MATCH' | 'NOT_NCK' | 'UNRESOLVABLE';

interface AutoFillResult {
  rowIndex: number;
  batchName: string;
  matchedName: string;
  source: 'CEK' | 'SAP' | '';
  score: number;
  derivedBarcode: string;
  originalBarcode: string;
  kind: StatusKind;
  note: string;
  confirmed: boolean;
}

interface CompareMaster {
  active: boolean; code: string; name: string; category: string; department: string;
  salesDef: string; price: number | null; plu: string | null; barcode: string | null;
  uom: string | null; folder: string | null; serviceCharge: boolean; tax1: boolean;
  tax2: boolean; noDiscount: boolean; hideReceipt: boolean; printers: string | null; outlets: string | null;
}

const STATUS_META: Record<StatusKind, { label: string; color: string; bg: string; border: string }> = {
  HIGH: { label: 'HIGH', color: '#2D4A2E', bg: 'rgba(61,90,62,0.06)', border: '#3D5A3E' },
  MEDIUM: { label: 'MEDIUM', color: '#8B6914', bg: 'rgba(201,168,76,0.07)', border: '#C9A84C' },
  LOW: { label: 'LOW - CONFIRM REQUIRED', color: '#7A2E1F', bg: 'rgba(122,46,31,0.09)', border: '#7A2E1F' },
  ALREADY_BARCODE: { label: 'SKIP - ALREADY HAS BARCODE', color: 'var(--text-secondary)', bg: 'transparent', border: 'var(--border)' },
  UNION_SKIP: { label: 'SKIP - UNION NO BARCODE', color: 'var(--text-secondary)', bg: 'transparent', border: 'var(--border)' },
  NO_MATCH: { label: 'NO MATCH', color: '#7A2E1F', bg: 'transparent', border: 'var(--border)' },
  NOT_NCK: { label: 'NO MATCH - NOT NCK', color: '#7A2E1F', bg: 'transparent', border: 'var(--border)' },
  UNRESOLVABLE: { label: 'NO MATCH - CONFIRMED UNRESOLVABLE', color: 'var(--text-secondary)', bg: 'transparent', border: 'var(--border)' },
};

const COMPARE_FIELDS: { label: string; idx: number; master: keyof CompareMaster; bool?: boolean }[] = [
  { label: 'Active', idx: 0, master: 'active', bool: true },
  { label: 'Code', idx: 1, master: 'code' },
  { label: 'Name', idx: 2, master: 'name' },
  { label: 'Category', idx: 3, master: 'category' },
  { label: 'Department', idx: 4, master: 'department' },
  { label: 'SalesDef', idx: 5, master: 'salesDef' },
  { label: 'Price', idx: 6, master: 'price' },
  { label: 'PLU', idx: 7, master: 'plu' },
  { label: 'Barcode', idx: 8, master: 'barcode' },
  { label: 'UOM', idx: 9, master: 'uom' },
  { label: 'Folder', idx: 10, master: 'folder' },
  { label: 'ServiceCharge', idx: 11, master: 'serviceCharge', bool: true },
  { label: 'Tax1', idx: 12, master: 'tax1', bool: true },
  { label: 'Tax2', idx: 13, master: 'tax2', bool: true },
  { label: 'NoDiscount', idx: 14, master: 'noDiscount', bool: true },
  { label: 'HideReceipt', idx: 15, master: 'hideReceipt', bool: true },
  { label: 'Printers', idx: 16, master: 'printers' },
  { label: 'Outlets', idx: 17, master: 'outlets' },
];

// digits-only of the NCK code, suffixed with "11" - e.g. "3151476(NCK)" → "315147611".
// Shared with the server-side wine dual-lookup via lib/barcode.ts.
const deriveBarcode = deriveNckBarcode;

// Union-only when every outlet in the field resolves to the UNION group (lib/outlets).
function isUnionOnly(outletsField: string): boolean {
  const parts = outletsField.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((o) => OUTLET_TO_GROUP[o] === 'UNION');
}

function isUnresolvable(name: string): boolean {
  const n = normalizeText(name);
  return CONFIRMED_UNRESOLVABLE.some((e) => n === e || n.includes(e));
}

// Last 2 digits of a 4-digit vintage in the batch name (e.g. "2022" → 22), else null.
function batchYear(name: string): number | null {
  const m = name.match(/(?:19|20)(\d{2})/);
  return m ? parseInt(m[0], 10) % 100 : null;
}

// Candidate years for a matched name: 4-digit vintages, else 2-digit tokens (range ends).
function yearsIn(name: string): number[] {
  const fours = Array.from(name.matchAll(/(?:19|20)\d{2}/g)).map((m) => parseInt(m[0], 10) % 100);
  if (fours.length) return fours;
  return Array.from(name.matchAll(/\b\d{2}\b/g)).map((m) => parseInt(m[0], 10));
}

function closestYear(name: string, target: number): number | null {
  const ys = yearsIn(name);
  if (!ys.length) return null;
  return ys.reduce((best, y) => (Math.abs(y - target) < Math.abs(best - target) ? y : best), ys[0]);
}

function bestFuzzy(name: string, candidates: string[]): { score: number; idx: number } {
  const n = normalizeText(name);
  let best = { score: 0, idx: -1 };
  for (let i = 0; i < candidates.length; i++) {
    const s = diceCoefficient(n, normalizeText(candidates[i]));
    if (s > best.score) best = { score: s, idx: i };
  }
  return best;
}

function tierOf(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= HIGH_MIN) return 'HIGH';
  if (score >= MEDIUM_MIN) return 'MEDIUM';
  return 'LOW';
}

// Barcode that should land in the final/comparison value: derived for auto-included
// rows (HIGH/MEDIUM) and confirmed LOW rows; otherwise the original (blank) value.
function effectiveBarcode(r: AutoFillResult): string {
  if (r.kind === 'HIGH' || r.kind === 'MEDIUM') return r.derivedBarcode;
  if (r.kind === 'LOW' && r.confirmed) return r.derivedBarcode;
  return r.originalBarcode;
}

function normBoolStr(v: string): string {
  const s = v.trim().toLowerCase();
  return (s === '' || s === '0' || s === 'false' || s === 'no') ? '0' : '1';
}

// Core per-row resolution following the spec cascade: pre-checks → CEK fuzzy →
// SAP fuzzy → vintage tiebreaker (only when both qualify) → NCK gate → derive.
function computeRow(cells: string[], rowIndex: number, cek: CekRow[], sap: SapRow[]): AutoFillResult {
  const name = (cells[2] ?? '').trim();
  const originalBarcode = (cells[8] ?? '').trim();
  const outlets = (cells[17] ?? '').trim();
  const base: Omit<AutoFillResult, 'kind'> = {
    rowIndex, batchName: name, matchedName: '', source: '', score: 0,
    derivedBarcode: '', originalBarcode, note: '', confirmed: false,
  };

  if (originalBarcode) return { ...base, kind: 'ALREADY_BARCODE' };
  if (isUnionOnly(outlets)) return { ...base, kind: 'UNION_SKIP' };
  if (isUnresolvable(name)) return { ...base, kind: 'UNRESOLVABLE', note: 'No barcode exists' };

  const cekBest = bestFuzzy(name, cek.map((c) => c.name));
  const sapBest = bestFuzzy(name, sap.map((s) => s.description));
  const cekQual = cekBest.idx >= 0 && cekBest.score >= FUZZY_MIN;
  const sapQual = sapBest.idx >= 0 && sapBest.score >= FUZZY_MIN;

  if (!cekQual && !sapQual) return { ...base, kind: 'NO_MATCH' };

  let source: 'CEK' | 'SAP';
  if (cekQual && sapQual) {
    const cekName = cek[cekBest.idx].name;
    const sapName = sap[sapBest.idx].description;
    const by = batchYear(name);
    let pick: 'CEK' | 'SAP' | null = null;
    if (by != null) {
      const cy = closestYear(cekName, by);
      const sy = closestYear(sapName, by);
      const cd = cy != null ? Math.abs(by - cy) : Infinity;
      const sd = sy != null ? Math.abs(by - sy) : Infinity;
      if (cd <= 1 && sd > 1) pick = 'CEK';
      else if (sd <= 1 && cd > 1) pick = 'SAP';
    }
    // Both within ±1, neither within ±1, or no batch year → higher score; tie → CEK.
    if (!pick) pick = sapBest.score > cekBest.score ? 'SAP' : 'CEK';
    source = pick;
  } else {
    source = cekQual ? 'CEK' : 'SAP';
  }

  const code = source === 'CEK' ? cek[cekBest.idx].code : sap[sapBest.idx].itemNo;
  const matchedName = source === 'CEK' ? cek[cekBest.idx].name : sap[sapBest.idx].description;
  const score = source === 'CEK' ? cekBest.score : sapBest.score;

  if (!code.toUpperCase().includes('(NCK)')) {
    return { ...base, kind: 'NOT_NCK', source, matchedName, score, note: 'Item found but not NCK' };
  }

  return { ...base, kind: tierOf(score), source, matchedName, score, derivedBarcode: deriveBarcode(code) };
}

function masterVal(m: CompareMaster, f: (typeof COMPARE_FIELDS)[number]): string {
  const v = m[f.master];
  if (f.bool) return v ? '1' : '0';
  if (f.master === 'price') return m.price != null ? String(m.price) : '';
  return v == null ? '' : String(v).trim();
}

function batchVal(cells: string[], f: (typeof COMPARE_FIELDS)[number], r: AutoFillResult | undefined): string {
  if (f.idx === 8) return (r ? effectiveBarcode(r) : (cells[8] ?? '')).trim();
  const raw = (cells[f.idx] ?? '').trim();
  return f.bool ? normBoolStr(raw) : raw;
}

// One numbered upload step: badge + bold label + plain-English description, then
// either the file picker or a green "✓ filename - N rows" confirmation line.
function StepSlot({ step, label, description, fileName, count, onPick }: {
  step: number; label: string; description: string; fileName: string; count: number; onPick: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const loaded = fileName !== '';
  return (
    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: loaded ? '#3D5A3E' : 'var(--bg-dark)', color: loaded ? '#fff' : 'var(--accent-gold)',
        fontSize: '0.82rem', fontWeight: 700,
      }}>
        {loaded ? <CheckCircle2 size={16} /> : step}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0.55rem', lineHeight: 1.45 }}>{description}</div>
        {loaded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 600, color: '#2D4A2E' }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName} - {count.toLocaleString()} row{count === 1 ? '' : 's'}
            </span>
            <button onClick={() => ref.current?.click()}
              style={{ marginLeft: '0.15rem', flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.72rem', textDecoration: 'underline', cursor: 'pointer' }}>
              Replace
            </button>
          </div>
        ) : (
          <button onClick={() => ref.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem',
              border: '1.5px dashed var(--border)', borderRadius: '6px', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem',
            }}>
            <Upload size={14} /> Choose .xlsx file
          </button>
        )}
        <input ref={ref} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); if (ref.current) ref.current.value = ''; }} />
      </div>
    </div>
  );
}

// Rotates through the still-missing file names in the disabled Run button label.
function WaitingLabel({ missing }: { missing: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (missing.length <= 1) return;
    const t = setInterval(() => setI((p) => p + 1), 1800);
    return () => clearInterval(t);
  }, [missing.length]);
  if (missing.length === 0) return null;
  return <>Waiting for {missing[i % missing.length]}…</>;
}

function BarcodeAutoFill() {
  const [batchRows, setBatchRows] = useState<string[][]>([]);
  const [batchFile, setBatchFile] = useState('');
  const [cekRows, setCekRows] = useState<CekRow[]>([]);
  const [cekFile, setCekFile] = useState('');
  const [sapRows, setSapRows] = useState<SapRow[]>([]);
  const [sapFile, setSapFile] = useState('');

  const [results, setResults] = useState<AutoFillResult[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const [comparing, setComparing] = useState(false);
  const [compareMap, setCompareMap] = useState<Record<string, CompareMaster | null> | null>(null);

  async function parseAoa(file: File): Promise<string[][]> {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
    return aoa.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
  }

  function requireXlsx(file: File): boolean {
    if (!file.name.toLowerCase().endsWith('.xlsx')) { toast.error('Hanya file .xlsx yang didukung.'); return false; }
    return true;
  }

  async function onBatch(file: File) {
    if (!requireXlsx(file)) return;
    try {
      const aoa = await parseAoa(file);
      const rows = aoa.slice(1) // row 1 is the 18-col header
        .filter((r) => r.some((c) => String(c).trim() !== ''))
        .map((r) => Array.from({ length: 18 }, (_, i) => String(r[i] ?? '').trim()));
      if (rows.length === 0) { toast.error('Batch file tidak berisi baris data.'); return; }
      setBatchRows(rows); setBatchFile(file.name);
      setResults([]); setHasRun(false); setCompareMap(null);
      toast.success(`Batch dimuat: ${rows.length} baris.`);
    } catch (e) { toast.error((e as Error)?.message ?? 'Gagal membaca batch file'); }
  }

  async function onCek(file: File) {
    if (!requireXlsx(file)) return;
    try {
      const aoa = await parseAoa(file);
      const rows = aoa.slice(3) // data starts on row 4
        .map((r) => ({ code: String(r[1] ?? '').trim(), name: String(r[2] ?? '').trim() }))
        .filter((c) => c.name !== '');
      if (rows.length === 0) { toast.error('CEK reference kosong.'); return; }
      setCekRows(rows); setCekFile(file.name);
      toast.success(`CEK reference dimuat: ${rows.length} item.`);
    } catch (e) { toast.error((e as Error)?.message ?? 'Gagal membaca CEK file'); }
  }

  async function onSap(file: File) {
    if (!requireXlsx(file)) return;
    try {
      const aoa = await parseAoa(file);
      const rows = aoa.slice(1) // row 1 is the header
        .map((r) => ({ itemNo: String(r[1] ?? '').trim(), description: String(r[2] ?? '').trim() }))
        .filter((s) => s.description !== '');
      if (rows.length === 0) { toast.error('SAP list kosong.'); return; }
      setSapRows(rows); setSapFile(file.name);
      toast.success(`SAP list dimuat: ${rows.length} item.`);
    } catch (e) { toast.error((e as Error)?.message ?? 'Gagal membaca SAP file'); }
  }

  const allLoaded = batchRows.length > 0 && cekRows.length > 0 && sapRows.length > 0;
  const missingFiles = [
    batchFile ? null : 'Your Batch File',
    cekFile ? null : 'CEK Barcode Reference',
    sapFile ? null : 'SAP Wine Item List',
  ].filter(Boolean) as string[];

  function runAutoFill() {
    setRunning(true);
    // Defer so the spinner paints before the synchronous matching pass runs.
    setTimeout(() => {
      setResults(batchRows.map((cells, i) => computeRow(cells, i, cekRows, sapRows)));
      setHasRun(true);
      setRunning(false);
    }, 0);
  }

  function confirmRow(rowIndex: number) {
    setResults((prev) => prev.map((r) => (r.rowIndex === rowIndex ? { ...r, confirmed: true } : r)));
  }

  const high = results.filter((r) => r.kind === 'HIGH').length;
  const medium = results.filter((r) => r.kind === 'MEDIUM').length;
  const confirmedLow = results.filter((r) => r.kind === 'LOW' && r.confirmed).length;
  const needConfirm = results.filter((r) => r.kind === 'LOW' && !r.confirmed).length;
  const noMatch = results.filter((r) => r.kind === 'NO_MATCH' || r.kind === 'NOT_NCK' || r.kind === 'UNRESOLVABLE').length;
  const skipped = results.filter((r) => r.kind === 'ALREADY_BARCODE' || r.kind === 'UNION_SKIP').length;
  const filled = high + medium + confirmedLow;

  async function downloadFilled() {
    const byRow = new Map(results.map((r) => [r.rowIndex, r]));
    const num = (v: string) => { const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; };
    const objs = batchRows.map((cells, i) => {
      const r = byRow.get(i);
      const bc = r ? effectiveBarcode(r) : (cells[8] ?? '').trim();
      const priceRaw = (cells[6] ?? '').trim();
      const priceNum = priceRaw === '' ? NaN : Number(priceRaw.replace(/[^0-9.-]/g, ''));
      return {
        Active: num(cells[0]), Code: cells[1], Name: cells[2], Category: cells[3], Department: cells[4],
        SalesDef: cells[5], Price: isNaN(priceNum) ? '' : priceNum, PLU: cells[7], Barcode: bc,
        UOM: cells[9], Folder: cells[10], ServiceCharge: num(cells[11]), Tax1: num(cells[12]),
        Tax2: num(cells[13]), NoDiscount: num(cells[14]), HideReceipt: num(cells[15]),
        Printers: cells[16], Outlets: cells[17],
      };
    });
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(objs, { header: [...BATCH_HEADERS] });
    ws['!cols'] = BATCH_HEADERS.map(() => ({ wch: 15 }));
    ws['!cols'][2] = { wch: 30 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filled');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url; a.download = `barcode-autofill-${date}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Diunduh: ${filled} barcode terisi.`);
  }

  async function runCompare() {
    if (batchRows.length === 0) { toast.error('Unggah batch file dulu.'); return; }
    setComparing(true);
    try {
      const codes = batchRows.map((c) => (c[1] ?? '').trim()).filter(Boolean);
      const res = await fetch('/api/admin/kb/barcode/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Compare gagal'); }
      const data = await res.json();
      setCompareMap(data.items ?? {});
    } catch (e) { toast.error((e as Error)?.message ?? 'Gagal membandingkan'); }
    finally { setComparing(false); }
  }

  const resultByRow = new Map(results.map((r) => [r.rowIndex, r]));
  const fmtScore = (s: number) => `${Math.round(s * 100)}%`;

  return (
    <div style={{ maxWidth: '1100px', margin: '2.5rem auto 0', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
      {/* ── Barcode Auto-Fill ─────────────────────────────────────────────── */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
        Barcode Auto-Fill
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Upload the 18-column batch plus the two SAP references. Missing barcodes are derived from matched NCK codes - entirely in your browser.
      </p>

      <div className="card" style={{ padding: '1.25rem 1.375rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', marginBottom: '1.25rem' }}>
          <StepSlot
            step={1}
            label="18-Column Batch (XLSX)"
            description="The file you exported from this system - same format used for imports. Rows with a blank Barcode column will be auto-filled."
            fileName={batchFile} count={batchRows.length} onPick={onBatch}
          />
          <StepSlot
            step={2}
            label="CEK Barcode Reference (SAP)"
            description="The CEK_BARCODE export from SAP. First source for NCK code lookup. Real data starts at row 4."
            fileName={cekFile} count={cekRows.length} onPick={onCek}
          />
          <StepSlot
            step={3}
            label="SAP List of Items - Wine"
            description="The full List_of_Items wine export from SAP. Used as fallback when CEK has no match."
            fileName={sapFile} count={sapRows.length} onPick={onSap}
          />
        </div>
        <button
          onClick={runAutoFill}
          disabled={!allLoaded || running}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem',
            background: !allLoaded || running ? 'rgba(26,16,8,0.4)' : 'var(--bg-dark)', color: 'var(--accent-gold)',
            border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700,
            cursor: !allLoaded || running ? 'not-allowed' : 'pointer',
          }}
        >
          {running && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          {running ? 'Processing…' : allLoaded ? 'Run Auto-Fill' : <WaitingLabel missing={missingFiles} />}
        </button>
      </div>

      {hasRun && (
        <>
          {/* Summary bar */}
          <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.875rem', fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              <strong>{filled}</strong> filled (<span style={{ color: '#2D4A2E' }}>{high} high</span>, <span style={{ color: '#8B6914' }}>{medium} medium</span>)
              {' | '}<span style={{ color: '#7A2E1F' }}>{needConfirm} need confirmation</span>
              {' | '}{noMatch} no match
              {' | '}{skipped} skipped
            </span>
            <button
              onClick={downloadFilled}
              disabled={filled === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '32px', padding: '0 0.875rem',
                background: filled === 0 ? 'transparent' : 'var(--bg-dark)', border: filled === 0 ? '1px solid var(--border)' : 'none',
                borderRadius: '0.375rem', fontSize: '0.76rem', fontWeight: 600,
                color: filled === 0 ? 'var(--text-secondary)' : 'var(--accent-gold)',
                cursor: filled === 0 ? 'not-allowed' : 'pointer', opacity: filled === 0 ? 0.6 : 1,
              }}
            >
              <Download size={13} /> Download Filled Batch
            </button>
          </div>

          {/* Results table */}
          <div className="card" style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Row #</th><th>Batch Name</th><th>Matched Name</th><th>Source</th>
                  <th>Score</th><th>Derived Barcode</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const meta = STATUS_META[r.kind];
                  const showBarcode = r.kind === 'HIGH' || r.kind === 'MEDIUM' || r.kind === 'LOW';
                  return (
                    <tr key={r.rowIndex} style={{ background: meta.bg, borderLeft: `3px solid ${meta.border}` }}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.rowIndex + 1}</td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 500, maxWidth: '240px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.batchName || '—'}</div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.matchedName || '—'}</div>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>{r.source || '—'}</td>
                      <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{r.source ? fmtScore(r.score) : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#8B6914' }}>
                        {showBarcode ? r.derivedBarcode : '—'}
                      </td>
                      <td style={{ fontSize: '0.7rem', fontWeight: 600, color: meta.color, fontStyle: r.kind === 'UNRESOLVABLE' ? 'italic' : 'normal' }}>
                        {meta.label}
                        {r.note && <div style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{r.note}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.kind === 'LOW' && !r.confirmed && (
                          <button
                            onClick={() => confirmRow(r.rowIndex)}
                            style={{ padding: '3px 9px', background: '#7A2E1F', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Confirm
                          </button>
                        )}
                        {r.kind === 'LOW' && r.confirmed && (
                          <span style={{ fontSize: '0.7rem', color: '#2D4A2E', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> Confirmed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Master Item Comparison ────────────────────────────────────────── */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
        Master Item Comparison
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        See what your batch will change before you upload it. Compares every row against the current master registry - side by side, all 18 columns.
        {hasRun && ' Barcode values reflect the post-fill state.'}
      </p>

      <button
        onClick={runCompare}
        disabled={batchRows.length === 0 || comparing}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', marginBottom: '1.25rem',
          background: batchRows.length === 0 || comparing ? 'rgba(26,16,8,0.4)' : 'var(--bg-dark)', color: 'var(--accent-gold)',
          border: 'none', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 600,
          cursor: batchRows.length === 0 || comparing ? 'not-allowed' : 'pointer',
        }}
      >
        {comparing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <GitCompareArrows size={14} />}
        {comparing ? 'Comparing…' : batchRows.length === 0 ? 'Upload a batch file to compare' : 'Compare Against Master →'}
      </button>

      {compareMap && (
        <div className="card" style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Field</th><th>Batch Value</th><th>Master Value</th><th>Changed?</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.map((cells, i) => {
                const code = (cells[1] ?? '').trim();
                const master = compareMap[code] ?? null;
                if (!master) {
                  return (
                    <tr key={`new-${i}`} style={{ background: 'rgba(201,168,76,0.08)' }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#C9A84C' }}>{code || '—'}</td>
                      <td colSpan={4} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8B6914' }}>
                        NOT IN MASTER - NEW ITEM
                      </td>
                    </tr>
                  );
                }
                const r = resultByRow.get(i);
                return COMPARE_FIELDS.map((f, fi) => {
                  const bv = batchVal(cells, f, r);
                  const mv = masterVal(master, f);
                  const changed = bv !== mv;
                  return (
                    <tr key={`${i}-${f.label}`} style={{ background: changed ? 'rgba(122,46,31,0.06)' : undefined }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 600, color: fi === 0 ? '#C9A84C' : 'transparent' }}>
                        {code}
                      </td>
                      <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{f.label}</td>
                      <td style={{ fontSize: '0.76rem', fontFamily: f.idx === 8 ? 'monospace' : undefined }}>{bv || '—'}</td>
                      <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: f.idx === 8 ? 'monospace' : undefined }}>{mv || '—'}</td>
                      <td style={{ fontSize: '0.72rem', fontWeight: 600, color: changed ? '#7A2E1F' : 'var(--text-secondary)' }}>
                        {changed ? 'YES' : '—'}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BarcodeLookupPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [registryEmpty, setRegistryEmpty] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if registry is empty on mount
  useEffect(() => {
    fetch('/api/admin/kb/items?page=1')
      .then((r) => r.json())
      .then((d) => setRegistryEmpty((d.total ?? 0) === 0))
      .catch(() => { });
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setItems([]); setTotal(0); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/kb/barcode?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setItems([]); setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  if (registryEmpty === true) {
    return (
      <div style={{ maxWidth: '560px', margin: '3rem auto', textAlign: 'center' }}>
        <ScanBarcode size={40} style={{ color: 'var(--border)', margin: '0 auto 0.875rem' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Registry is empty</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          No items have been imported yet. Upload a Quinos export CSV first.
        </p>
        <Link href="/admin/kb/items"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#1A1008', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
          Go to Master Items
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Barcode Lookup</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Search the master registry by code, barcode, PLU number, or name.
        </p>
      </div>

      {/* Search input */}
      <div style={{ maxWidth: '600px', margin: '0 auto 1.5rem', position: 'relative' }}>
        <ScanBarcode size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, barcode, or name…"
          style={{
            width: '100%', height: '50px', paddingLeft: '2.75rem', paddingRight: '1rem',
            borderRadius: '8px', border: '1.5px solid var(--input-border)',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {query.trim() && !loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No items found for &ldquo;{query}&rdquo;. The item may not be in the current registry.
            Try uploading a fresh Quinos export.
          </div>
        )}

        {items.map((item) => <ItemCard key={item.id} item={item} />)}

        {total > 10 && (
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
            Showing 10 of {total.toLocaleString()} results. Refine your search for more precise matches.
          </div>
        )}
      </div>

      <BarcodeAutoFill />
    </div>
  );
}
