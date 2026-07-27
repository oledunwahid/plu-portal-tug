'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, ChevronDown, X, Download, Filter } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { parsePriceLevels } from '@/lib/masterReport';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

interface MasterItem {
  id: string; active: boolean; code: string; name: string;
  category: string; department: string; salesDef: string;
  price: number | null; plu: string | null; barcode: string | null;
  uom: string | null; folder: string | null;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
  printers: string | null; outlets: string | null; outletGroup: string | null;
  priceLevels: string | null;
  importedAt: string; updatedAt: string;
  updatedBy?: string | null;
}

interface PriceGapRow {
  name: string; codes: string[]; minPrice: number; maxPrice: number; gap: number; outlets: string[];
}

interface BarcodeDupRow {
  barcode: string; count: number; codes: string[]; names: string[]; format: string;
}

interface QualityReport {
  duplicates: MasterItem[][];
  priceGaps: PriceGapRow[];
  duplicateBarcodes: BarcodeDupRow[];
  trialItems: MasterItem[];
}

const AMBER_BG = 'rgba(251,191,36,0.1)';
const PAGE_SIZE = 25;

// ── Shared utilities ─────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
interface SortState { key: string; dir: SortDir; }

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function sortRows<T>(rows: T[], accessor: (r: T) => string | number | null, dir: SortDir): T[] {
  const sorted = [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), 'id');
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

// "Format lama" if 6-7 digits, "NCK" if ends in 11, "Standard" otherwise.
function barcodeFormatLabel(barcode: string): string {
  const b = barcode.trim();
  if (/^\d{6,7}$/.test(b)) return 'Format lama';
  if (b.endsWith('11')) return 'NCK';
  return 'Standard';
}

function splitList(field: string | null | undefined): string[] {
  return (field ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

// ── Shared presentational bits ───────────────────────────────────────────────

function CountBadge({ n }: { n: number }) {
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: '999px',
      background: n > 0 ? 'rgba(201,168,76,0.14)' : 'rgba(61,90,62,0.1)',
      color: n > 0 ? '#8B6914' : '#2D4A2E',
      border: `1px solid ${n > 0 ? 'rgba(201,168,76,0.3)' : 'rgba(61,90,62,0.2)'}`,
    }}>
      {n.toLocaleString('id-ID')}
    </span>
  );
}

function PanelCard({
  title, description, count, children,
}: {
  title: string; description: string; count: number; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <CountBadge n={count} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

const SEARCH_INPUT: React.CSSProperties = {
  width: '100%', maxWidth: '420px', height: '34px', border: '1px solid var(--input-border)', borderRadius: '4px',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.75rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
};

function SearchRow({
  value, onChange, placeholder, filtered, total, extra,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; filtered: number; total: number; extra?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 240px' }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={SEARCH_INPUT} />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
          Menampilkan {filtered.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} hasil
        </div>
      </div>
      {extra}
    </div>
  );
}

function pgBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.85rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px',
    fontSize: '0.78rem', fontWeight: 600, color: disabled ? 'var(--text-secondary)' : '#8B6914',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
  };
}

function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: '0.875rem', borderTop: '1px solid var(--border)' }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={pgBtnStyle(page <= 1)}>Previous</button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Halaman {page} dari {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={pgBtnStyle(page >= totalPages)}>Next</button>
    </div>
  );
}

function SortTh({
  label, col, sort, setSort, numeric,
}: {
  label: string; col: string; sort: SortState; setSort: (s: SortState) => void; numeric?: boolean;
}) {
  const active = sort.key === col;
  return (
    <th
      onClick={() => setSort(active ? { key: col, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: col, dir: 'asc' })}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: numeric ? 'right' : 'left' }}
    >
      {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );
}

const TD_CODE: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#C9A84C', letterSpacing: '0.03em', whiteSpace: 'nowrap' };
const TD_NUM: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const NAME_CELL: React.CSSProperties = { fontWeight: 500, maxWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 };

const DETAIL_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem',
  background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px',
  fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
};

function OutletChips({ outlets }: { outlets: string[] }) {
  if (outlets.length === 0) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '220px' }}>
      {outlets.slice(0, 6).map((o) => (
        <span key={o} style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o}</span>
      ))}
      {outlets.length > 6 && <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>+{outlets.length - 6}</span>}
    </div>
  );
}

// ── Item Detail Slide-over ───────────────────────────────────────────────────

function SkelLine({ w = '100%', h = 12 }: { w?: string; h?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 4, marginBottom: 8 }} />;
}

function SlideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
      <div className="label-caps" style={{ fontSize: '0.62rem', marginBottom: '0.625rem', color: '#8B6914' }}>{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.25rem 0', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function PillRow({ values, gold }: { values: string[]; gold?: boolean }) {
  if (values.length === 0) return <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
      {values.map((v) => (
        <span key={v} style={{
          fontSize: '0.7rem', padding: '2px 7px', borderRadius: '3px',
          background: gold ? 'rgba(201,168,76,0.08)' : 'var(--bg-cream)',
          border: `1px solid ${gold ? 'rgba(201,168,76,0.2)' : 'var(--border)'}`,
          color: gold ? '#8B6914' : 'var(--text-secondary)',
        }}>{v}</span>
      ))}
    </div>
  );
}

function ItemDetailSlideOver({ code, onClose }: { code: string; onClose: () => void }) {
  const [item, setItem] = useState<MasterItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItem(null);
    fetch(`/api/admin/kb/items/${encodeURIComponent(code)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Gagal memuat item')))
      .then((data) => { if (!cancelled) setItem(data); })
      .catch((e) => { if (!cancelled) toast.error(e.message ?? 'Gagal memuat detail item'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  const priceLevels = item ? parsePriceLevels(item.priceLevels) : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '94vw', background: 'var(--bg-card)', zIndex: 50, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em' }}>{code}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading || !item ? (
            <div style={{ padding: '1.5rem' }}>
              <SkelLine w="70%" h={20} />
              <SkelLine w="40%" />
              <div style={{ height: 16 }} />
              <SkelLine w="100%" h={48} />
              <div style={{ height: 16 }} />
              <SkelLine w="90%" />
              <SkelLine w="80%" />
              <SkelLine w="85%" />
            </div>
          ) : (
            <>
              {/* Section 1 - Identity */}
              <SlideSection title="Identitas">
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '0.5rem', wordBreak: 'break-word' }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '3px', fontWeight: 600,
                    background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(26,16,8,0.06)',
                    color: item.active ? '#2D4A2E' : 'var(--text-secondary)',
                    border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'var(--border)'}`,
                  }}>{item.active ? 'Active' : 'Inactive'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.category || '—'} <span style={{ opacity: 0.5 }}>|</span> {item.department || '—'}
                  </span>
                </div>
              </SlideSection>

              {/* Section 2 - Pricing */}
              <SlideSection title="Harga">
                <DetailRow label="Sell Price" value={item.price != null ? formatPrice(item.price) : '—'} />
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Price Levels</div>
                  {priceLevels.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Tidak ada price level</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {priceLevels.map((pl, i) => (
                        <div key={i} style={{ fontSize: '0.76rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          <strong>{pl.salesType}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}> - {pl.outlets.join(', ') || '—'} - </span>
                          {pl.price != null ? formatPrice(pl.price) : '—'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SlideSection>

              {/* Section 3 - Item Details */}
              <SlideSection title="Detail Item">
                <DetailRow label="PLU" value={item.plu ?? '—'} mono />
                <DetailRow
                  label="Barcode"
                  value={item.barcode
                    ? <span>{item.barcode} <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 400 }}>({barcodeFormatLabel(item.barcode)})</span></span>
                    : '—'}
                  mono
                />
                <DetailRow label="UOM" value={item.uom ?? '—'} />
                <DetailRow label="Folder" value={item.folder ?? '—'} />
                <DetailRow label="SalesDef" value={item.salesDef ?? '—'} />
              </SlideSection>

              {/* Section 4 - Outlets and Printers */}
              <SlideSection title="Outlet & Printer">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Outlets</div>
                <PillRow values={splitList(item.outlets)} gold />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.75rem 0 0.375rem' }}>Printers</div>
                <PillRow values={splitList(item.printers)} />
              </SlideSection>

              {/* Section 5 - System */}
              <SlideSection title="Sistem">
                <DetailRow label="Code" value={item.code} mono />
                {item.updatedBy && <DetailRow label="Diperbarui oleh" value={item.updatedBy} />}
                {item.updatedAt && (
                  <DetailRow
                    label="Terakhir diperbarui"
                    value={new Date(item.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  />
                )}
              </SlideSection>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Panel 1: Duplicate analysis + SAP evidence ───────────────────────────────

type Classification = 'LIKELY_DUPLICATE' | 'SAP_SEPARATED' | 'AMBIGUOUS' | 'NO_SAP_EVIDENCE';

interface SapMatch {
  itemNo: string; description: string; subGroup: string | null; barcode: string | null;
  score: number; reason: string; isNck: boolean; normalizedBase: string;
}
interface DupMaster {
  id: string; code: string; name: string; category: string; department: string;
  price: number | null; barcode: string | null; outlets: string | null;
  outletGroup: string | null; folder: string | null;
}
interface DupGroup {
  id: string; classification: Classification; confidence: number; reason: string;
  recommendedAction: string; key: string; base: string; prefix: string; department: string;
  category: string; outlets: string[]; price: number | null;
  masterItems: DupMaster[]; sapMatches: SapMatch[];
  sizeDiff: boolean; typeDiff: boolean; nckVariance: boolean; distinctSapBases: number;
}
interface GroupEvidence {
  sapMatches: SapMatch[]; classification: Classification; confidence: number; reason: string;
  recommendedAction: string; sizeDiff: boolean; typeDiff: boolean; nckVariance: boolean; distinctSapBases: number;
}
interface DupCounts { total: number; likelyDuplicate: number; sapSeparated: number; ambiguous: number; noSapEvidence: number; }
interface DupFilterOptions { departments: string[]; categories: string[]; outlets: string[]; prefixes: string[]; }
interface DupResponse {
  groups: DupGroup[]; page: number; limit: number; totalGroups: number; totalPages: number;
  counts: DupCounts; filterOptions: DupFilterOptions;
}

type EvidenceState = { loading: boolean; error: boolean; data: GroupEvidence | null };
const SAP_SCOPE_NOTE = 'Bukti SAP dimuat per grup saat dibuka, dan hanya muncul bila ada baris SAP yang cocok (registry SAP saat ini paling lengkap untuk WINE).';
const DUP_PAGE_LIMIT = 50;

const CLS_META: Record<Classification, { label: string; color: string; bg: string; border: string }> = {
  LIKELY_DUPLICATE: { label: 'Kemungkinan Duplikat', color: '#7A2E1F', bg: 'rgba(122,46,31,0.08)', border: 'rgba(122,46,31,0.25)' },
  SAP_SEPARATED: { label: 'Terpisah oleh SAP', color: '#2D4A2E', bg: 'rgba(61,90,62,0.1)', border: 'rgba(61,90,62,0.25)' },
  AMBIGUOUS: { label: 'Ambigu', color: '#8B6914', bg: AMBER_BG, border: 'rgba(201,168,76,0.3)' },
  NO_SAP_EVIDENCE: { label: 'Tanpa Bukti SAP', color: 'var(--text-secondary)', bg: 'rgba(26,16,8,0.05)', border: 'var(--border)' },
};
const ACTION_LABEL: Record<string, string> = {
  MERGE_OR_REMOVE: 'Gabung / Hapus', KEEP_SEPARATE_SAP_EVIDENCE: 'Biarkan terpisah (bukti SAP)',
  REVIEW_MANUALLY: 'Tinjau manual', NEED_SAP_CHECK: 'Cek SAP',
};
const REASON_LABEL: Record<string, string> = {
  'exact-barcode': 'Barcode sama', 'exact-name': 'Nama sama', 'fuzzy-name': 'Mirip nama',
  'nck-related': 'Terkait NCK', weak: 'Lemah',
};

const CLASS_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'LIKELY_DUPLICATE', label: 'Kemungkinan Duplikat' },
  { value: 'SAP_SEPARATED', label: 'Terpisah oleh SAP' },
  { value: 'AMBIGUOUS', label: 'Ambigu' },
  { value: 'NO_SAP_EVIDENCE', label: 'Tanpa Bukti SAP' },
];

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', border: '1px solid var(--input-border)', borderRadius: '4px',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem',
  fontSize: '0.78rem', outline: 'none', minWidth: '130px',
};

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={SELECT_STYLE}>
        <option value="ALL">Semua</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ClassBadge({ cls, confidence }: { cls: Classification; confidence?: number }) {
  const m = CLS_META[cls];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.label}{confidence != null ? <span style={{ opacity: 0.7, fontWeight: 600 }}>{Math.round(confidence * 100)}%</span> : null}
    </span>
  );
}

function csvEscape(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportDuplicatesCsv(groups: DupGroup[]) {
  const headers = [
    'duplicateGroupId', 'classification', 'confidence', 'reason', 'masterItemCodes',
    'masterItemNames', 'department', 'category', 'outlets', 'prices',
    'sapItemNosMatched', 'sapDescriptionsMatched', 'sapMatchScores', 'recommendedAction',
  ];
  const rows = groups.map((g) => {
    const prices = Array.from(new Set(g.masterItems.map((it) => (it.price != null ? String(it.price) : '')))).filter(Boolean).join(' | ');
    return [
      g.key, g.classification, g.confidence, g.reason,
      g.masterItems.map((it) => it.code).join(' | '),
      g.masterItems.map((it) => it.name).join(' | '),
      g.department, g.category, g.outlets.join(' | '), prices,
      g.sapMatches.map((m) => m.itemNo).join(' | '),
      g.sapMatches.map((m) => m.description).join(' | '),
      g.sapMatches.map((m) => m.score).join(' | '),
      g.recommendedAction,
    ];
  });
  const csv = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `duplicate-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SapMatchTable({ matches }: { matches: SapMatch[] }) {
  if (matches.length === 0) {
    return <div style={{ padding: '0.75rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Tidak ada baris SAP yang cocok.</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr><th>SAP ItemNo</th><th>Description</th><th>SubGroup</th><th style={{ textAlign: 'right' }}>Score</th><th>Alasan</th></tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.itemNo}>
              <td style={{ ...TD_CODE, color: m.isNck ? '#8B6914' : '#C9A84C' }}>
                {m.itemNo}{m.isNck && <span style={{ fontSize: '0.6rem', marginLeft: 4, padding: '0 4px', borderRadius: 3, background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)' }}>NCK</span>}
              </td>
              <td style={{ fontSize: '0.78rem', maxWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{m.description}</td>
              <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.subGroup ?? '—'}</td>
              <td style={{ ...TD_NUM, fontWeight: 700, color: m.score >= 0.7 ? '#2D4A2E' : m.score >= 0.5 ? '#8B6914' : 'var(--text-secondary)' }}>{Math.round(m.score * 100)}%</td>
              <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{REASON_LABEL[m.reason] ?? m.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffChips({ g }: { g: DupGroup }) {
  const chips: string[] = [];
  if (g.nckVariance) chips.push('NCK vs non-NCK');
  if (g.sizeDiff) chips.push('Ukuran berbeda');
  if (g.typeDiff) chips.push('Tipe BT/SG');
  if (g.distinctSapBases >= 2) chips.push(`${g.distinctSapBases} itemNo SAP`);
  if (chips.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
      {chips.map((c) => (
        <span key={c} style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 7px', borderRadius: '3px', background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)' }}>{c}</span>
      ))}
    </div>
  );
}

function DuplicateAnalysisPanel({ onOpenDetail }: { onOpenDetail: (code: string) => void }) {
  const [department, setDepartment] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [outlet, setOutlet] = useState('ALL');
  const [prefix, setPrefix] = useState('ALL');
  const [classification, setClassification] = useState('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('default');
  const search = useDebounced(searchInput, 350);
  const dMinPrice = useDebounced(minPrice, 400);
  const dMaxPrice = useDebounced(maxPrice, 400);

  const [data, setData] = useState<DupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(false);
  const [options, setOptions] = useState<DupFilterOptions>({ departments: [], categories: [], outlets: [], prefixes: [] });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [evidence, setEvidence] = useState<Record<string, EvidenceState>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setSlow(false);
    setError(false);
    const slowTimer = setTimeout(() => setSlow(true), 3000);
    const params = new URLSearchParams();
    if (department !== 'ALL') params.set('department', department);
    if (category !== 'ALL') params.set('category', category);
    if (outlet !== 'ALL') params.set('outlet', outlet);
    if (prefix !== 'ALL') params.set('prefix', prefix);
    if (classification !== 'ALL') params.set('classification', classification);
    if (search.trim()) params.set('search', search.trim());
    if (dMinPrice.trim()) params.set('minPrice', dMinPrice.trim());
    if (dMaxPrice.trim()) params.set('maxPrice', dMaxPrice.trim());
    if (sort !== 'default') params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', String(DUP_PAGE_LIMIT));
    fetch(`/api/admin/kb/quality/duplicates?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Gagal memuat analisis duplikat')))
      .then((d: DupResponse) => {
        setData(d);
        // filterOptions are global (computed pre-filter) - keep the fullest set seen.
        setOptions((prev) => ({
          departments: d.filterOptions.departments.length ? d.filterOptions.departments : prev.departments,
          categories: d.filterOptions.categories.length ? d.filterOptions.categories : prev.categories,
          outlets: d.filterOptions.outlets.length ? d.filterOptions.outlets : prev.outlets,
          prefixes: d.filterOptions.prefixes.length ? d.filterOptions.prefixes : prev.prefixes,
        }));
        setLoading(false);
        setSlow(false);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setError(true);
        setLoading(false);
        setSlow(false);
      });
    return () => { clearTimeout(slowTimer); ctrl.abort(); };
  }, [department, category, outlet, prefix, classification, search, dMinPrice, dMaxPrice, sort, page]);

  // Reset to page 1 whenever the filter/search/sort selection changes.
  useEffect(() => { setPage(1); }, [department, category, outlet, prefix, classification, search, dMinPrice, dMaxPrice, sort]);

  const groups = data?.groups ?? [];
  const counts = data?.counts ?? { total: 0, likelyDuplicate: 0, sapSeparated: 0, ambiguous: 0, noSapEvidence: 0 };
  const totalPages = data?.totalPages ?? 1;
  const safePage = data?.page ?? page;

  // Overlay any lazily-loaded SAP evidence onto its group.
  const pageGroups = groups.map((g) => {
    const ev = evidence[g.key]?.data;
    return ev ? { ...g, ...ev } : g;
  });

  async function fetchEvidence(g: DupGroup) {
    const key = g.key;
    setEvidence((prev) => ({ ...prev, [key]: { loading: true, error: false, data: null } }));
    try {
      const res = await fetch(`/api/admin/kb/quality/duplicates/evidence?groupId=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error();
      const d: GroupEvidence = await res.json();
      setEvidence((prev) => ({ ...prev, [key]: { loading: false, error: false, data: d } }));
    } catch {
      setEvidence((prev) => ({ ...prev, [key]: { loading: false, error: true, data: null } }));
    }
  }

  function toggleGroup(g: DupGroup) {
    const key = g.key;
    const opening = !expanded.has(key);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    // Lazy-load SAP evidence on first expand (unless already inlined by search).
    if (opening && !evidence[key] && g.sapMatches.length === 0) fetchEvidence(g);
  }

  const countChips: { value: string; label: string; n: number; cls?: Classification }[] = [
    { value: 'ALL', label: 'Semua', n: counts.total },
    { value: 'LIKELY_DUPLICATE', label: 'Kemungkinan Duplikat', n: counts.likelyDuplicate, cls: 'LIKELY_DUPLICATE' },
    { value: 'SAP_SEPARATED', label: 'Terpisah oleh SAP', n: counts.sapSeparated, cls: 'SAP_SEPARATED' },
    { value: 'AMBIGUOUS', label: 'Ambigu', n: counts.ambiguous, cls: 'AMBIGUOUS' },
    { value: 'NO_SAP_EVIDENCE', label: 'Tanpa Bukti SAP', n: counts.noSapEvidence, cls: 'NO_SAP_EVIDENCE' },
  ];

  return (
    <PanelCard
      title="Analisis Duplikat + Bukti SAP"
      description="Kelompok Master Item yang tampak duplikat, diklasifikasikan dengan bukti dari SAP (itemNo / NCK / ukuran / tipe). Alat bukti & tinjauan - tidak mengubah data."
      count={counts.total}
    >
      {/* Filter bar */}
      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FilterSelect label="Department" value={department} options={options.departments} onChange={setDepartment} />
        <FilterSelect label="Kategori" value={category} options={options.categories} onChange={setCategory} />
        <FilterSelect label="Outlet" value={outlet} options={options.outlets} onChange={setOutlet} />
        <FilterSelect label="Prefix" value={prefix} options={options.prefixes} onChange={setPrefix} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Harga</span>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" inputMode="numeric" style={{ ...SELECT_STYLE, minWidth: '80px', width: '80px' }} />
            <span style={{ color: 'var(--text-secondary)' }}>–</span>
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" inputMode="numeric" style={{ ...SELECT_STYLE, minWidth: '80px', width: '80px' }} />
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Urut</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={SELECT_STYLE}>
            <option value="default">Prioritas (default)</option>
            <option value="confidence">Confidence</option>
            <option value="prefix">Prefix</option>
            <option value="count">Jumlah item</option>
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => exportDuplicatesCsv(pageGroups)}
          disabled={pageGroups.length === 0}
          title="Ekspor halaman yang sedang tampil"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.85rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, color: pageGroups.length ? '#8B6914' : 'var(--text-secondary)', cursor: pageGroups.length ? 'pointer' : 'not-allowed', opacity: pageGroups.length ? 1 : 0.5 }}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Search + classification chips */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cari kode, nama, barcode, kategori, SAP itemNo..." style={SEARCH_INPUT} />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {countChips.map((c) => {
            const active = classification === c.value;
            const meta = c.cls ? CLS_META[c.cls] : null;
            return (
              <button
                key={c.value}
                onClick={() => setClassification(c.value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', borderRadius: '999px',
                  fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  background: active ? (meta ? meta.bg : 'rgba(201,168,76,0.14)') : 'transparent',
                  color: active ? (meta ? meta.color : '#8B6914') : 'var(--text-secondary)',
                  border: `1px solid ${active ? (meta ? meta.border : 'rgba(201,168,76,0.4)') : 'var(--border)'}`,
                }}
              >
                {c.label}
                <span style={{ fontWeight: 700, opacity: 0.85 }}>{c.n.toLocaleString('id-ID')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SAP scope note */}
      <div style={{ padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)' }}>SAP</span>
        {SAP_SCOPE_NOTE}
      </div>

      {loading ? (
        <div>
          <TableSkeleton rows={4} cols={5} />
          {slow && (
            <div style={{ padding: '0.5rem 1.25rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Analisis masih diproses…
            </div>
          )}
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem 1.25rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderRadius: '6px', background: 'rgba(122,46,31,0.06)', border: '1px solid rgba(122,46,31,0.25)', color: '#7A2E1F', fontSize: '0.82rem', lineHeight: 1.5 }}>
            <strong>Gagal memuat analisis data quality.</strong><br />
            Coba refresh atau kecilkan filter.
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Filter size={20} style={{ opacity: 0.4, marginBottom: '0.5rem' }} /><br />
          Tidak ada kandidat duplikat untuk filter ini.
        </div>
      ) : (
        <>
          <div>
            {pageGroups.map((g) => {
              const open = expanded.has(g.key);
              const meta = CLS_META[g.classification];
              const repName = g.masterItems[0]?.name ?? '';
              return (
                <div key={g.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Group header */}
                  <div onClick={() => toggleGroup(g)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.25rem', cursor: 'pointer', background: open ? meta.bg : 'transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <ClassBadge cls={g.classification} confidence={g.confidence} />
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A84C', fontSize: '0.76rem' }}>{g.prefix}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{repName}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          {' • '}{g.masterItems.length} master{' • '}{g.sapMatches.length} SAP
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, maxWidth: '760px' }}>{g.reason}</div>
                      <DiffChips g={g} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 7px', borderRadius: '3px', background: 'var(--bg-cream)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {ACTION_LABEL[g.recommendedAction] ?? g.recommendedAction}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{g.price != null ? formatPrice(g.price) : '—'}</span>
                    </div>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0, marginTop: '0.15rem' }} />
                  </div>

                  {/* Expanded detail */}
                  {open && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.01)' }}>
                      <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: '#8B6914', textTransform: 'uppercase' }}>Master Item ({g.masterItems.length})</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table>
                          <thead>
                            <tr><th>Code</th><th>Name</th><th>Kategori</th><th>Dept</th><th style={{ textAlign: 'right' }}>Price</th><th>Barcode</th><th>Outlets</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
                          </thead>
                          <tbody>
                            {g.masterItems.map((it) => (
                              <tr key={it.id}>
                                <td style={TD_CODE}>{it.code}</td>
                                <td style={NAME_CELL}>{it.name}</td>
                                <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{it.category}</td>
                                <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{it.department}</td>
                                <td style={TD_NUM}>{it.price != null ? formatPrice(it.price) : '—'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: it.barcode ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{it.barcode || '—'}</td>
                                <td><OutletChips outlets={splitList(it.outlets)} /></td>
                                <td style={{ textAlign: 'right' }}>
                                  <button onClick={(e) => { e.stopPropagation(); onOpenDetail(it.code); }} style={DETAIL_BTN}>Lihat Detail</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ padding: '0.75rem 1.25rem 0.25rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', color: '#8B6914', textTransform: 'uppercase' }}>Bukti SAP ({g.sapMatches.length})</div>
                      <div style={{ padding: '0 1.25rem 1rem' }}>
                        {evidence[g.key]?.loading ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Memuat bukti SAP…
                          </div>
                        ) : evidence[g.key]?.error ? (
                          <div style={{ padding: '0.75rem 0', fontSize: '0.78rem', color: '#7A2E1F' }}>
                            Gagal memuat bukti SAP. Coba buka ulang grup ini.
                          </div>
                        ) : (
                          <SapMatchTable matches={g.sapMatches} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationBar page={safePage} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </PanelCard>
  );
}

// ── Panel 2: Price gaps ──────────────────────────────────────────────────────

function PriceGapPanel({ loading, rows, onOpenDetail }: { loading: boolean; rows: PriceGapRow[]; onOpenDetail: (code: string) => void }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'gap', dir: 'desc' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) list = rows.filter((r) => r.name.toLowerCase().includes(q) || r.codes.some((c) => c.toLowerCase().includes(q)));
    const acc = (r: PriceGapRow): string | number | null => {
      switch (sort.key) {
        case 'name': return r.name;
        case 'minPrice': return r.minPrice;
        case 'maxPrice': return r.maxPrice;
        default: return r.gap;
      }
    };
    return sortRows(list, acc, sort.dir);
  }, [rows, search, sort]);

  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <PanelCard
      title="Selisih Harga"
      description="Item dengan nama yang sama tetapi harga berbeda antar outlet atau price level."
      count={rows.length}
    >
      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : rows.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Tidak ada selisih harga ditemukan.
        </div>
      ) : (
        <>
          <SearchRow value={searchInput} onChange={setSearchInput} placeholder="Cari nama item..." filtered={filtered.length} total={rows.length} />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <SortTh label="Name" col="name" sort={sort} setSort={setSort} />
                  <th>Codes <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.68rem' }}>(klik kode untuk detail)</span></th>
                  <SortTh label="Min Price" col="minPrice" sort={sort} setSort={setSort} numeric />
                  <SortTh label="Max Price" col="maxPrice" sort={sort} setSort={setSort} numeric />
                  <SortTh label="Gap" col="gap" sort={sort} setSort={setSort} numeric />
                  <th>Outlets</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr
                    key={`${row.name}-${i}`}
                    onClick={() => row.codes[0] && onOpenDetail(row.codes[0])}
                    style={{ cursor: row.codes[0] ? 'pointer' : 'default' }}
                  >
                    <td style={NAME_CELL}>{row.name}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '220px' }}>
                        {row.codes.map((c) => (
                          <button key={c} onClick={() => onOpenDetail(c)} style={{ ...TD_CODE, background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer' }}>{c}</button>
                        ))}
                      </div>
                    </td>
                    <td style={TD_NUM}>{formatPrice(row.minPrice)}</td>
                    <td style={TD_NUM}>{formatPrice(row.maxPrice)}</td>
                    <td style={{ ...TD_NUM, fontWeight: 700, color: '#8B6914' }}>{formatPrice(row.gap)}</td>
                    <td><OutletChips outlets={row.outlets} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={safePage} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </PanelCard>
  );
}

// ── Panel 3: Duplicate barcodes ──────────────────────────────────────────────

function BarcodePanel({ loading, rows, onOpenDetail }: { loading: boolean; rows: BarcodeDupRow[]; onOpenDetail: (code: string) => void }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'count', dir: 'desc' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) list = rows.filter((r) => r.barcode.toLowerCase().includes(q) || r.names.some((n) => n.toLowerCase().includes(q)));
    const acc = (r: BarcodeDupRow): string | number | null => {
      switch (sort.key) {
        case 'barcode': return r.barcode;
        case 'format': return r.format;
        default: return r.count;
      }
    };
    return sortRows(list, acc, sort.dir);
  }, [rows, search, sort]);

  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <PanelCard
      title="Barcode Duplikat"
      description="Beberapa item menggunakan barcode yang sama."
      count={rows.length}
    >
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : rows.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Tidak ada barcode duplikat ditemukan.
        </div>
      ) : (
        <>
          <SearchRow value={searchInput} onChange={setSearchInput} placeholder="Cari barcode atau nama item..." filtered={filtered.length} total={rows.length} />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <SortTh label="Barcode" col="barcode" sort={sort} setSort={setSort} />
                  <SortTh label="Items" col="count" sort={sort} setSort={setSort} numeric />
                  <th>Codes</th>
                  <th>Names</th>
                  <SortTh label="Format" col="format" sort={sort} setSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={`${row.barcode}-${i}`}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.barcode}</td>
                    <td style={TD_NUM}>{row.count}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '220px' }}>
                        {row.codes.map((c) => (
                          <button key={c} onClick={() => onOpenDetail(c)} title="Lihat detail" style={{ ...TD_CODE, background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer' }}>{c}</button>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', maxWidth: '260px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>{row.names.join(', ')}</td>
                    <td>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '3px',
                        background: row.format === 'Standard' ? 'rgba(61,90,62,0.1)' : AMBER_BG,
                        color: row.format === 'Standard' ? '#2D4A2E' : '#8B6914',
                        border: `1px solid ${row.format === 'Standard' ? 'rgba(61,90,62,0.2)' : 'rgba(201,168,76,0.3)'}`,
                        whiteSpace: 'nowrap',
                      }}>{row.format}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={safePage} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </PanelCard>
  );
}

// ── Panel 4: Trial / placeholder ─────────────────────────────────────────────

function TrialPanel({
  loading, items, onOpenDetail, onDeactivate, deactivatingCode,
}: {
  loading: boolean; items: MasterItem[]; onOpenDetail: (code: string) => void;
  onDeactivate: (item: MasterItem) => void; deactivatingCode: string | null;
}) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q) list = items.filter((it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q));
    const acc = (it: MasterItem): string | number | null => {
      switch (sort.key) {
        case 'code': return it.code;
        case 'department': return it.department;
        default: return it.name;
      }
    };
    return sortRows(list, acc, sort.dir);
  }, [items, search, sort]);

  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <PanelCard
      title="Item Trial / Open Modifier"
      description="Item dengan nama yang mengindikasikan data test coba atau modifier terbuka."
      count={items.length}
    >
      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : items.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Tidak ada item trial atau placeholder ditemukan.
        </div>
      ) : (
        <>
          <SearchRow value={searchInput} onChange={setSearchInput} placeholder="Cari kode atau nama item..." filtered={filtered.length} total={items.length} />
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <SortTh label="Code" col="code" sort={sort} setSort={setSort} />
                  <SortTh label="Name" col="name" sort={sort} setSort={setSort} />
                  <th>Category</th>
                  <SortTh label="Department" col="department" sort={sort} setSort={setSort} />
                  <th>Active Status</th>
                  <th>Outlets</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((it) => (
                  <tr key={it.id} onClick={() => onOpenDetail(it.code)} style={{ cursor: 'pointer' }}>
                    <td style={TD_CODE}>{it.code}</td>
                    <td style={NAME_CELL}>{it.name}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{it.category}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{it.department}</td>
                    <td>
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                        background: it.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                        color: it.active ? '#2D4A2E' : '#7A2E1F',
                        border: `1px solid ${it.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`,
                      }}>{it.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td><OutletChips outlets={splitList(it.outlets)} /></td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDeactivate(it)}
                        disabled={deactivatingCode === it.code}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.3rem 0.65rem', background: 'transparent',
                          border: '1px solid rgba(122,46,31,0.25)', borderRadius: '4px',
                          fontSize: '0.72rem', fontWeight: 600, color: '#7A2E1F',
                          cursor: deactivatingCode === it.code ? 'wait' : 'pointer',
                          opacity: deactivatingCode === it.code ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}>
                        {deactivatingCode === it.code && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Nonaktifkan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={safePage} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </PanelCard>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DataQualityPage() {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivatingCode, setDeactivatingCode] = useState<string | null>(null);
  const [detailCode, setDetailCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kb/quality');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Gagal memuat data');
      }
      setReport(await res.json());
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal memuat data kualitas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDeactivate(item: MasterItem) {
    setDeactivatingCode(item.code);
    try {
      const res = await fetch(`/api/admin/kb/items/${encodeURIComponent(item.code)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal'); }
      setReport((prev) => prev ? { ...prev, trialItems: prev.trialItems.filter((t) => t.code !== item.code) } : prev);
      toast.success('Item dinonaktifkan.');
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal menonaktifkan item');
    } finally {
      setDeactivatingCode(null);
    }
  }

  const priceGaps = report?.priceGaps ?? [];
  const duplicateBarcodes = report?.duplicateBarcodes ?? [];
  const trialItems = report?.trialItems ?? [];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <AlertTriangle size={22} style={{ color: '#C9A84C' }} />
          <h1 className="page-title">Data Quality</h1>
        </div>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Identifikasi masalah data pada Master Item Registry.
        </p>
      </div>

      <DuplicateAnalysisPanel onOpenDetail={setDetailCode} />
      <PriceGapPanel loading={loading} rows={priceGaps} onOpenDetail={setDetailCode} />
      <BarcodePanel loading={loading} rows={duplicateBarcodes} onOpenDetail={setDetailCode} />
      <TrialPanel
        loading={loading} items={trialItems} onOpenDetail={setDetailCode}
        onDeactivate={handleDeactivate} deactivatingCode={deactivatingCode}
      />

      {detailCode && <ItemDetailSlideOver code={detailCode} onClose={() => setDetailCode(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
