'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Upload, Download,
  Database, Wine as WineIcon, SlidersHorizontal, AlertTriangle,
} from 'lucide-react';
import { WINE_MESSAGES, formatVintage } from '@/lib/wine';
import { useWineMasterData } from '@/components/wine/useWineMasterData';
import { WINE_SELECT_STYLE, WINE_FIELD_STYLE, formatRupiah, formatDateTime, splitList } from '@/components/wine/wineUi';

interface WineRow {
  id: string;
  wineName: string;
  displayName: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  status: string;
  producerName: string | null;
  countryName: string | null;
  regionName: string | null;
  appellationName: string | null;
  wineTypeName: string | null;
  bottleSizeName: string | null;
  varietalNames: string | null;
  duplicateIndication: boolean;
  updatedAt: string;
  masterItemCode: string | null;
  master: {
    code: string; name: string; barcode: string | null; price: number | null;
    outlets: string | null; active: boolean;
  } | null;
}

type SortKey = 'wineName' | 'vintage' | 'producer' | 'price' | 'updatedAt' | 'createdAt';

const PAGE_SIZES = [25, 50, 100];

function StatusBadge({ status }: { status: string }) {
  const active = status === 'Active';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem',
      borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      background: active ? 'rgba(61,90,62,0.1)' : 'rgba(100,100,100,0.08)',
      color: active ? '#2D4A2E' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'rgba(61,90,62,0.25)' : 'var(--border)'}`,
    }}>
      {status}
    </span>
  );
}

function SortHeader({ label, sortKey, sort, dir, onSort, align }: {
  label: string; sortKey: SortKey; sort: SortKey; dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void; align?: 'right';
}) {
  const active = sort === sortKey;
  return (
    <th style={{ whiteSpace: 'nowrap', textAlign: align }}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'inherit',
          textTransform: 'inherit', letterSpacing: 'inherit',
        }}
      >
        {label}
        {active && (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </button>
    </th>
  );
}

export default function WineListPage() {
  const router = useRouter();
  const masterData = useWineMasterData();

  const [rows, setRows] = useState<WineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [vintageOptions, setVintageOptions] = useState<number[]>([]);
  const [outletOptions, setOutletOptions] = useState<string[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'Active',
    producerId: '',
    countryId: '',
    regionId: '',
    appellationId: '',
    wineTypeId: '',
    categoryId: '',
    bottleSizeId: '',
    vintage: '',
    outlet: '',
    completeness: '',
    duplicates: false,
  });
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filters.status) params.set('status', filters.status);
    if (filters.producerId) params.set('producerId', filters.producerId);
    if (filters.countryId) params.set('countryId', filters.countryId);
    if (filters.regionId) params.set('regionId', filters.regionId);
    if (filters.appellationId) params.set('appellationId', filters.appellationId);
    if (filters.wineTypeId) params.set('wineTypeId', filters.wineTypeId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.bottleSizeId) params.set('bottleSizeId', filters.bottleSizeId);
    if (filters.vintage) params.set('vintage', filters.vintage);
    if (filters.outlet) params.set('outlet', filters.outlet);
    if (filters.completeness) params.set('completeness', filters.completeness);
    if (filters.duplicates) params.set('duplicates', '1');
    params.set('sort', sort);
    params.set('dir', dir);
    return params.toString();
  }, [search, filters, sort, dir]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set('page', String(page));
      params.set('limit', String(limit));
      // Option lists barely change - fetch them once with the first page load.
      if (!optionsLoaded) params.set('withOptions', '1');
      const res = await fetch(`/api/wines?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setCanViewCost(Boolean(data.canViewCost));
      if (data.vintages) { setVintageOptions(data.vintages); setOptionsLoaded(true); }
      if (data.outlets) setOutletOptions(data.outlets);
      if (data.stats) setStats(data.stats);
      setFailed(false);
    } catch {
      setRows([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [queryString, page, limit, optionsLoaded]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim().length >= 2 ? value.trim() : '');
      setPage(1);
    }, 300);
  }

  function setFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function handleSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setDir(key === 'wineName' || key === 'producer' ? 'asc' : 'desc'); }
    setPage(1);
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setFilters({
      status: 'Active', producerId: '', countryId: '', regionId: '', appellationId: '',
      wineTypeId: '', categoryId: '', bottleSizeId: '', vintage: '', outlet: '',
      completeness: '', duplicates: false,
    });
    setPage(1);
  }

  async function handleExport() {
    try {
      const params = new URLSearchParams(queryString);
      const res = await fetch(`/api/wines/export?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Export gagal.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wine-list-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export Wine List berhasil.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export gagal.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status') return value !== 'Active';
    if (key === 'duplicates') return value === true;
    return Boolean(value);
  }).length + (search ? 1 : 0);

  const options = masterData.data;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Wine List</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Katalog wine Cork &amp; Screw. Data PLU, harga, barcode dan outlet mengikuti Master Item.
            {stats && (
              <>
                {' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {stats.total.toLocaleString('id-ID')} wine
                </span>{' '}
                ({stats.active.toLocaleString('id-ID')} active · {stats.inactive.toLocaleString('id-ID')} inactive)
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/wine/master-data" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
            <Database size={13} /> Master Data
          </Link>
          <Link href="/wine/import" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
            <Upload size={13} /> Import
          </Link>
          <button type="button" onClick={handleExport} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={13} /> Export
          </button>
          <Link href="/wine/list/new" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
            <Plus size={13} /> Add Wine
          </Link>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search wine, PLU, barcode, producer, vintage..."
              style={{ ...WINE_FIELD_STYLE, paddingLeft: '1.8rem' }}
            />
          </div>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} style={WINE_SELECT_STYLE}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="ALL">All Status</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <SlidersHorizontal size={13} /> Filters
            {activeFilterCount > 0 && (
              <span style={{ background: '#C9A84C', color: '#1C1107', borderRadius: '9999px', fontSize: '0.62rem', fontWeight: 700, padding: '0 5px' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Reset
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.6rem' }}>
            {([
              ['producerId', 'All Producers', options.PRODUCER],
              ['countryId', 'All Countries', options.COUNTRY],
              ['regionId', 'All Regions', options.REGION],
              ['appellationId', 'All Appellations', options.APPELLATION],
              ['wineTypeId', 'All Wine Types', options.WINE_TYPE],
              ['categoryId', 'All Categories', options.CATEGORY],
              ['bottleSizeId', 'All Bottle Sizes', options.BOTTLE_SIZE],
            ] as const).map(([key, placeholder, list]) => (
              <select
                key={key}
                value={filters[key]}
                onChange={(e) => setFilter(key, e.target.value)}
                style={{ ...WINE_SELECT_STYLE, width: '100%' }}
              >
                <option value="">{placeholder}</option>
                {list.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            ))}
            <select value={filters.vintage} onChange={(e) => setFilter('vintage', e.target.value)} style={{ ...WINE_SELECT_STYLE, width: '100%' }}>
              <option value="">All Vintages</option>
              <option value="NV">Non-Vintage (NV)</option>
              {vintageOptions.map((v) => <option key={v} value={String(v)}>{v}</option>)}
            </select>
            <select value={filters.outlet} onChange={(e) => setFilter('outlet', e.target.value)} style={{ ...WINE_SELECT_STYLE, width: '100%' }}>
              <option value="">All Outlets</option>
              {outletOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={filters.completeness} onChange={(e) => setFilter('completeness', e.target.value)} style={{ ...WINE_SELECT_STYLE, width: '100%' }}>
              <option value="">Complete &amp; Incomplete</option>
              <option value="COMPLETE">Complete data</option>
              <option value="INCOMPLETE">Incomplete data</option>
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.duplicates}
                onChange={(e) => setFilter('duplicates', e.target.checked)}
              />
              Duplicate indication
            </label>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '1rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          {loading ? 'Memuat...' : `${total.toLocaleString('id-ID')} wine ditemukan`}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Rows</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ ...WINE_SELECT_STYLE, height: '28px', fontSize: '0.75rem' }}
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : failed ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: '#8B3A2A', marginBottom: '0.75rem' }}>{WINE_MESSAGES.loadFailed}</p>
            <button type="button" onClick={fetchRows} className="btn-secondary">Coba kembali</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <WineIcon size={26} style={{ color: 'var(--border)', marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1rem' }}>
              {activeFilterCount > 0
                ? 'Tidak ada wine yang cocok dengan filter.'
                : WINE_MESSAGES.emptyList}
            </p>
            {activeFilterCount === 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <Link href="/wine/list/new" className="btn-primary" style={{ textDecoration: 'none' }}>Add Wine</Link>
                <Link href="/wine/pending-publication" className="btn-secondary" style={{ textDecoration: 'none' }}>
                  Pending Publication
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>PLU Code</th>
                  <SortHeader label="Wine Name" sortKey="wineName" sort={sort} dir={dir} onSort={handleSort} />
                  <SortHeader label="Vintage" sortKey="vintage" sort={sort} dir={dir} onSort={handleSort} />
                  <SortHeader label="Producer" sortKey="producer" sort={sort} dir={dir} onSort={handleSort} />
                  <th>Country</th>
                  <th>Region</th>
                  <th>Appellation</th>
                  <th>Type</th>
                  <th>Bottle Size</th>
                  <th>Barcode</th>
                  <SortHeader label="Price" sortKey="price" sort={sort} dir={dir} onSort={handleSort} align="right" />
                  <th>Outlets</th>
                  <SortHeader label="Last Updated" sortKey="updatedAt" sort={sort} dir={dir} onSort={handleSort} />
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/wine/list/${row.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#C9A84C', fontWeight: 600 }}>
                        {row.master?.code ?? row.masterItemCode ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 500, minWidth: '200px' }}>
                      {row.wineName}
                      {row.duplicateIndication && (
                        <span
                          title="Potensi duplikat: nama + vintage + bottle size sama dengan wine lain"
                          style={{ marginLeft: '0.35rem', display: 'inline-flex', verticalAlign: 'middle', color: '#8B6914' }}
                        >
                          <AlertTriangle size={11} />
                        </span>
                      )}
                      {row.master && !row.master.active && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.6rem', color: '#8B3A2A', fontWeight: 700 }}>
                          MASTER INACTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                      {formatVintage(row.vintage, row.isNonVintage)}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{row.producerName ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.countryName ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.regionName ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.appellationName ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.wineTypeName ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.bottleSizeName ?? '—'}</td>
                    <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {row.master?.barcode || '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatRupiah(row.master?.price ?? null)}
                    </td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {splitList(row.master?.outlets).join(', ') || '—'}
                    </td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link
                        href={`/wine/list/${row.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: '0.72rem', color: '#8B6914', textDecoration: 'none', marginRight: '0.5rem' }}
                      >
                        View
                      </Link>
                      <Link
                        href={`/wine/list/${row.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: '0.72rem', color: '#8B6914', textDecoration: 'none' }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > limit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {!canViewCost && !loading && rows.length > 0 && (
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          {WINE_MESSAGES.costForbidden}
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
