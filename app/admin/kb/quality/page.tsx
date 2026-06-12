'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, ChevronDown, X } from 'lucide-react';
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
              {/* Section 1 — Identity */}
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

              {/* Section 2 — Pricing */}
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
                          <span style={{ color: 'var(--text-secondary)' }}> — {pl.outlets.join(', ') || '—'} — </span>
                          {pl.price != null ? formatPrice(pl.price) : '—'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SlideSection>

              {/* Section 3 — Item Details */}
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

              {/* Section 4 — Outlets and Printers */}
              <SlideSection title="Outlet & Printer">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Outlets</div>
                <PillRow values={splitList(item.outlets)} gold />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.75rem 0 0.375rem' }}>Printers</div>
                <PillRow values={splitList(item.printers)} />
              </SlideSection>

              {/* Section 5 — System */}
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

// ── Panel 1: Duplicate accordion ─────────────────────────────────────────────

interface DupGroup {
  key: string; prefix: string; department: string; category: string;
  price: number | null; items: MasterItem[]; folderDiffers: boolean;
}

function buildDupGroups(duplicates: MasterItem[][]): DupGroup[] {
  return duplicates.filter((g) => g.length > 0).map((group) => {
    const folders = new Set(group.map((it) => (it.folder ?? '').trim()));
    return {
      key: group[0].id,
      prefix: group[0].code.substring(0, 3),
      department: group[0].department,
      category: group[0].category,
      price: group[0].price,
      items: group,
      folderDiffers: folders.size > 1,
    };
  });
}

function DupSortBtn({ label, col, sort, setSort }: { label: string; col: string; sort: SortState; setSort: (s: SortState) => void }) {
  const active = sort.key === col;
  return (
    <button
      onClick={() => setSort(active ? { key: col, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: col, dir: 'asc' })}
      style={{
        padding: '0.25rem 0.6rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 600,
        border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border)'}`,
        background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
        color: active ? '#8B6914' : 'var(--text-secondary)', cursor: 'pointer',
      }}
    >
      {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function DuplicatePanel({ loading, duplicates, onOpenDetail }: { loading: boolean; duplicates: MasterItem[][]; onOpenDetail: (code: string) => void }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'prefix', dir: 'asc' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => buildDupGroups(duplicates), [duplicates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = groups;
    if (q) list = groups.filter((g) => g.items.some((it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)));
    const acc = (g: DupGroup): string | number | null =>
      sort.key === 'price' ? (g.price ?? -1)
        : sort.key === 'count' ? g.items.length
          : (g as unknown as Record<string, string>)[sort.key];
    return sortRows(list, acc, sort.dir);
  }, [groups, search, sort]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allOpen = pageGroups.length > 0 && pageGroups.every((g) => expanded.has(g.key));
  function toggleAll() {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (allOpen) pageGroups.forEach((g) => next.delete(g.key));
      else pageGroups.forEach((g) => next.add(g.key));
      return next;
    });
  }
  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <PanelCard
      title="Kandidat Duplikat"
      description="Item dengan prefix, kategori, department, harga, dan price level yang sama berpotensi digabung."
      count={groups.length}
    >
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : groups.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Tidak ada kandidat duplikat ditemukan.
        </div>
      ) : (
        <>
          <SearchRow
            value={searchInput} onChange={setSearchInput} placeholder="Cari kode atau nama item..."
            filtered={filtered.length} total={groups.length}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={toggleAll} style={{ ...DETAIL_BTN, color: '#8B6914', borderColor: 'rgba(201,168,76,0.3)' }}>
                  {allOpen ? 'Tutup Semua' : 'Buka Semua'}
                </button>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Urut:</span>
                <DupSortBtn label="Prefix" col="prefix" sort={sort} setSort={setSort} />
                <DupSortBtn label="Price" col="price" sort={sort} setSort={setSort} />
                <DupSortBtn label="Jumlah" col="count" sort={sort} setSort={setSort} />
              </div>
            }
          />
          <div>
            {pageGroups.map((g) => {
              const open = expanded.has(g.key);
              return (
                <div key={g.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Accordion header */}
                  <div
                    onClick={() => toggleGroup(g.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', cursor: 'pointer', background: open ? AMBER_BG : 'transparent' }}
                  >
                    <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A84C' }}>PREFIX {g.prefix}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {' • '}{g.department || '—'}{' • '}{g.category || '—'}{' • '}{g.items.length} item
                      </span>
                    </div>
                    {g.folderDiffers && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '3px', background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)', whiteSpace: 'nowrap' }}>
                        Folder berbeda
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {g.price != null ? formatPrice(g.price) : '—'}
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }} />
                  </div>
                  {/* Accordion body */}
                  {open && (
                    <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Code</th><th>Name</th><th>Folder</th><th>Outlets</th><th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((it) => (
                            <tr key={it.id}>
                              <td style={TD_CODE}>{it.code}</td>
                              <td style={NAME_CELL}>{it.name}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{it.folder ?? '—'}</td>
                              <td><OutletChips outlets={splitList(it.outlets)} /></td>
                              <td style={{ textAlign: 'right' }}>
                                <button onClick={() => onOpenDetail(it.code)} style={DETAIL_BTN}>Lihat Detail</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

  const duplicates = report?.duplicates ?? [];
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

      <DuplicatePanel loading={loading} duplicates={duplicates} onOpenDetail={setDetailCode} />
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
