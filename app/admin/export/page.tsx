'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { PlusCircle, Tag, Type, Printer, Trash2, Check, Download, Loader2, Layers, Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import { collapseAdminOutlets } from '@/lib/outlets';
import StatusBadge from '@/components/StatusBadge';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import {
  EMPTY_TYPE_STAT, SOURCE_LABELS, STATUS_COLORS, buildStatsQuery,
  type StatsSummaryResponse, type TypeStat,
} from '@/lib/requestStats';

type RequestType = 'NEW_ITEM' | 'UPDATE_PRICE' | 'UPDATE_NAME' | 'UPDATE_PRINTER' | 'REMOVE_PLU';

interface PLURequest {
  id: string;
  requestType: string;
  status: string;
  code: string | null;
  name: string;
  category: string;
  department: string;
  price: number | null;
  folder: string | null;
  printers: string;
  outlets: string;
  cashierOutlet: string;
  outletGroup: string;
  createdAt: string;
  // Cost-control barcodes (WINE NEW_ITEM from Cork outlets). confirmedBarcode is what cost control
  // saved; suggestedBarcode is the system's NCK-derived guess shown before confirmation.
  suggestedBarcode?: string | null;
  confirmedBarcode?: string | null;
  submittedBy: { name: string; outlet: string };
  // Enriched from the master item registry for UPDATE_PRICE / UPDATE_NAME (empty string if not found).
  masterName?: string;
  masterCategory?: string;
  // Audit trail - who last changed the record and when.
  updatedBy?: string | null;
  updatedAt?: string | null;
  // Export tracking.
  exportCount?: number;
  lastExportedAt?: string | null;
  lastExportedBy?: string | null;
}

interface TabConfig {
  type: RequestType;
  label: string;
  Icon: React.ElementType;
  color: string;
  lightColor: string;
  format: 'XLSX' | 'CSV';
}

// Every section opens on PENDING: processing the queue is the admin's job, so unprocessed work is
// always what the page shows first.
const DEFAULT_STATUS = 'PENDING';

const TABS: TabConfig[] = [
  { type: 'NEW_ITEM', label: 'New Items', Icon: PlusCircle, color: '#2D4A2E', lightColor: 'rgba(45,74,46,0.12)', format: 'XLSX' },
  { type: 'UPDATE_PRICE', label: 'Update Price', Icon: Tag, color: '#8B6914', lightColor: 'rgba(139,105,20,0.12)', format: 'CSV' },
  { type: 'UPDATE_NAME', label: 'Update Name', Icon: Type, color: '#7A2E1F', lightColor: 'rgba(122,46,31,0.12)', format: 'CSV' },
  { type: 'UPDATE_PRINTER', label: 'Change Printer', Icon: Printer, color: '#1F3A5F', lightColor: 'rgba(31,58,95,0.12)', format: 'CSV' },
  { type: 'REMOVE_PLU', label: 'Remove PLU', Icon: Trash2, color: '#8B3A2A', lightColor: 'rgba(139,58,42,0.12)', format: 'CSV' },
];

const SELECT_STYLE = {
  height: '34px',
  borderRadius: '0.375rem',
  border: '1px solid var(--input-border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '0 0.625rem',
  fontSize: '0.8rem',
  cursor: 'pointer',
  outline: 'none',
};

const DATE_STYLE = {
  height: '34px',
  borderRadius: '0.375rem',
  border: '1px solid var(--input-border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '0 0.5rem',
  fontSize: '0.8rem',
  outline: 'none',
};

// Admin "Mark Done" only applies to requests in an admin-actionable status. DONE is already final;
// PENDING_COST_CONTROL is still with cost control and REJECTED was killed there - both read-only here.
const isAdminActionable = (status: string): boolean =>
  status !== 'DONE' && status !== 'PENDING_COST_CONTROL' && status !== 'REJECTED';

type ColumnDef = { key: string; label: string; render: (r: PLURequest) => React.ReactNode };

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AuditLine({ by, at }: { by?: string | null; at?: string | null }) {
  if (!by) return null;
  return (
    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
      Diperbarui oleh {by}{at ? ` • ${formatAuditDate(at)}` : ''}
    </div>
  );
}

// Shared status cell - badge plus the audit line underneath (only renders when updatedBy is set).
const STATUS_COL: ColumnDef = {
  key: 'status',
  label: 'Status',
  render: (r) => (
    <div>
      <StatusBadge status={r.status} />
      <AuditLine by={r.updatedBy} at={r.updatedAt} />
      {(r.exportCount ?? 0) > 0 && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Dieksport {r.exportCount}x
        </div>
      )}
    </div>
  ),
};

const COLUMNS: Record<RequestType, ColumnDef[]> = {
  NEW_ITEM: [
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'category', label: 'Category', render: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.category}</span> },
    { key: 'dept', label: 'Department', render: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.department}</span> },
    { key: 'price', label: 'Price', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.price ? formatPrice(r.price) : '—'}</span> },
    {
      key: 'barcode', label: 'Barcode', render: (r) => {
        const confirmed = r.confirmedBarcode;
        const value = confirmed ?? r.suggestedBarcode ?? null;
        if (!value) return <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>—</span>;
        return (
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: confirmed ? 'var(--text-primary)' : 'var(--text-secondary)' }} title={confirmed ? 'Confirmed by cost control' : 'Suggested (awaiting cost control)'}>
            {value}{!confirmed && r.suggestedBarcode ? ' ?' : ''}
          </span>
        );
      }
    },
    { key: 'folder', label: 'Folder', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.folder ?? '—'}</span> },
    { key: 'printers', label: 'Printers', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.printers.replace(/;/g, ' · ')}</span> },
    { key: 'outlets', label: 'Outlets', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{collapseAdminOutlets(r.outlets).replace(/;/g, ' · ')}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    STATUS_COL,
  ],
  UPDATE_PRICE: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.masterName || '—'}</span> },
    { key: 'category', label: 'Category', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.masterCategory || '—'}</span> },
    { key: 'price', label: 'New Price', render: (r) => <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.price ? formatPrice(r.price) : '—'}</span> },
    { key: 'outlet', label: 'Outlet', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    STATUS_COL,
  ],
  UPDATE_NAME: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'currentName', label: 'Current Name', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.masterName || '—'}</span> },
    { key: 'name', label: 'New Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name || '—'}</span> },
    { key: 'outlet', label: 'Outlet', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    STATUS_COL,
  ],
  UPDATE_PRINTER: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'printers', label: 'New Printers', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.printers.replace(/;/g, ' · ')}</span> },
    { key: 'outlets', label: 'Outlets', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{collapseAdminOutlets(r.outlets).replace(/;/g, ' · ')}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    STATUS_COL,
  ],
  REMOVE_PLU: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name || '—'}</span> },
    { key: 'outlet', label: 'Outlet', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    STATUS_COL,
  ],
};

const FALLBACK_GROUPS = ['UNION', 'CNS', 'FRENCH', 'IBR', 'IND'];

const VALID_TYPES: RequestType[] = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'REMOVE_PLU'];

// The four lifecycle views of the list, in processing order. PENDING first - that's the work.
const VALID_STATUSES = ['PENDING', 'EXPORTED', 'DONE', 'ALL'];

const STATUS_TAB_LABELS: Record<string, { label: string; hint: string }> = {
  PENDING: { label: 'Pending', hint: 'Menunggu proses' },
  EXPORTED: { label: 'Exported', hint: 'Sudah diekspor, belum selesai' },
  DONE: { label: 'Done', hint: 'Selesai' },
  ALL: { label: 'All', hint: 'Semua status' },
};

// The exact 19 columns the export file will contain, in order. The "Export preview" toggle renders
// these straight from the server-computed rows (same requestToTemplateRow sourcing as the download),
// so the admin can verify the populated data before committing to the file.
const EXPORT_PREVIEW_COLUMNS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef', 'Price', 'PLU', 'Barcode', 'UOM',
  'Folder', 'ServiceCharge', 'Tax1', 'Tax2', 'NoDiscount', 'HideReceipt', 'Printers', 'Outlets',
  'PriceLevels',
] as const;

type PreviewRow = { id: string } & Record<string, string | number>;

// Render a preview cell. `undefined` row = not loaded yet (skeleton, never blank/zero); an empty
// value is shown as an em-dash because the file genuinely carries a blank there.
function previewCellText(row: PreviewRow | undefined, key: string): string {
  if (!row) return '…';
  const v = row[key];
  if (v === '' || v === null || v === undefined) return '—';
  return String(v);
}

// Done items accumulate over time, so only that view is paginated.
const DONE_PAGE_SIZE = 25;

function donePgBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.85rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px',
    fontSize: '0.78rem', fontWeight: 600, color: disabled ? 'var(--text-secondary)' : '#8B6914',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
  };
}

function DonePagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: '0.875rem', borderTop: '1px solid var(--border)' }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={donePgBtnStyle(page <= 1)}>Previous</button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Halaman {page} dari {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={donePgBtnStyle(page >= totalPages)}>Next</button>
    </div>
  );
}

function ExportPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const adminName = (session?.user as { name?: string } | undefined)?.name ?? null;
  const [markingDone, setMarkingDone] = useState(false);
  const [activeType, setActiveType] = useState<RequestType>('NEW_ITEM');
  const [group, setGroup] = useState('ALL');
  const [outletGroups, setOutletGroups] = useState<string[]>(FALLBACK_GROUPS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS);
  const [requests, setRequests] = useState<PLURequest[]>([]);
  const [stats, setStats] = useState<StatsSummaryResponse | null>(null);
  const [statsError, setStatsError] = useState(false);
  // `search` is what the admin types; `activeSearch` is the debounced value actually queried.
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'XLSX' | 'CSV' | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [donePage, setDonePage] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewMap, setPreviewMap] = useState<Map<string, PreviewRow>>(new Map());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingPriceLevels, setDownloadingPriceLevels] = useState(false);

  const activeTab = TABS.find((t) => t.type === activeType)!;
  const columns = COLUMNS[activeType];
  const statsSource = sourceFilter === 'BATCH' ? 'batch' : 'single';

  // Debounce the search box so a fetch fires once the admin stops typing, not per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setActiveSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Per-type Pending / Exported / Done / Total for the card strip. Scoped by exactly the same
  // filters as the list below (source, group, date range, search) so the cards and the table can
  // never disagree.
  const fetchStats = useCallback(async () => {
    try {
      const qs = buildStatsQuery({ source: statsSource, group, from, to, search: activeSearch });
      const res = await fetch(`/api/admin/stats/summary?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setStats(await res.json());
      setStatsError(false);
    } catch {
      // Never fall back to zeros - "0 pending" must mean the queue is empty, not that a fetch failed.
      setStats(null);
      setStatsError(true);
    }
  }, [statsSource, group, from, to, activeSearch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statFor = (type: RequestType): TypeStat => stats?.byType?.[type] ?? EMPTY_TYPE_STAT;
  const activeStat = statFor(activeType);

  const flattenBatches = useCallback((batchData: any[]): any[] =>
    batchData.flatMap((b: any) =>
      (b.items as any[]).map((item: any) => ({
        ...item,
        id: `${b.id}:${item.id}`,
        requestType: b.requestType,
        status: b.status,
        cashierOutlet: b.cashierOutlet,
        outletGroup: b.outletGroup,
        createdAt: b.createdAt,
        submittedBy: b.submittedBy,
        updatedBy: b.updatedBy,
        updatedAt: b.updatedAt,
        exportCount: b.exportCount,
        lastExportedAt: b.lastExportedAt,
        lastExportedBy: b.lastExportedBy,
      }))
    )
    , []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ requestType: activeType });
      if (group !== 'ALL') params.set('outletGroup', group);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (activeSearch) params.set('search', activeSearch);

      if (sourceFilter === 'BATCH') {
        const res = await fetch(`/api/admin/batches?${params}`);
        if (!res.ok) throw new Error();
        setRequests(flattenBatches(await res.json()) as any);
      } else {
        const res = await fetch(`/api/admin/requests?${params}`);
        if (!res.ok) throw new Error();
        setRequests(await res.json());
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeType, group, statusFilter, from, to, sourceFilter, activeSearch, flattenBatches]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Fetch the export-preview rows for the currently loaded set. Reuses the export route's preview
  // mode (preview=1) so the displayed 19 columns are computed by the exact same requestToTemplateRow
  // sourcing the file uses - no logic duplicated client-side. Only runs while the toggle is on.
  const fetchPreview = useCallback(async () => {
    if (requests.length === 0) { setPreviewMap(new Map()); return; }
    setPreviewLoading(true);
    try {
      const isBatch = sourceFilter === 'BATCH';
      const exportIds = isBatch
        ? Array.from(new Set(requests.map((r) => r.id.split(':')[0])))
        : requests.map((r) => r.id);
      const params = new URLSearchParams({ ids: exportIds.join(','), type: activeType, preview: '1' });
      const apiPath = isBatch
        ? `/api/admin/export/batches/csv?${params}`
        : `/api/admin/export/csv?${params}`;
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const map = new Map<string, PreviewRow>();
      for (const row of (data.rows ?? []) as PreviewRow[]) map.set(row.id, row);
      setPreviewMap(map);
    } catch {
      setPreviewMap(new Map());
      toast.error('Gagal memuat pratinjau ekspor.');
    } finally {
      setPreviewLoading(false);
    }
  }, [requests, sourceFilter, activeType]);

  useEffect(() => { if (previewMode) fetchPreview(); }, [previewMode, fetchPreview]);

  // Reset Done pagination whenever the view it paginates changes (tab switch, filters, source).
  useEffect(() => { setDonePage(1); }, [activeType, statusFilter, sourceFilter, group, from, to, activeSearch]);

  useEffect(() => {
    fetch('/api/config/outlets?activeOnly=true')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { group: string }[] | null) => {
        if (!data) return;
        const groups = Array.from(new Set(data.map((o) => o.group))).sort();
        if (groups.length > 0) setOutletGroups(groups);
      })
      .catch(() => { });
  }, []);

  // Pre-select the view from query params (dashboard pending cards deep-link here with the whole
  // scope: type, status, source, group and date range). Unrecognized/absent values leave the
  // defaults (NEW_ITEM / PENDING / SINGLE) untouched.
  useEffect(() => {
    const t = searchParams.get('type');
    if (t && (VALID_TYPES as string[]).includes(t)) setActiveType(t as RequestType);

    const s = searchParams.get('status');
    if (s && VALID_STATUSES.includes(s)) setStatusFilter(s);

    const src = searchParams.get('source');
    if (src === 'BATCH' || src === 'SINGLE') setSourceFilter(src);

    const g = searchParams.get('group');
    if (g) setGroup(g);
    const f = searchParams.get('from');
    if (f) setFrom(f);
    const tt = searchParams.get('to');
    if (tt) setTo(tt);
  }, [searchParams]);

  // Switching section keeps the status the admin is currently working in (e.g. reviewing Done
  // items across types) - the page still *opens* on Pending.
  function switchTab(type: RequestType) {
    setActiveType(type);
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === requests.length && requests.length > 0 ? new Set() : new Set(requests.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Optimistically flag the given rows as DONE with the current admin as the auditor.
  // Both PENDING and EXPORTED rows can transition to DONE.
  function applyDoneLocally(rowMatches: (r: PLURequest) => boolean) {
    const now = new Date().toISOString();
    setRequests((prev) => prev.map((r) =>
      rowMatches(r) && r.status !== 'DONE'
        ? { ...r, status: 'DONE', updatedBy: adminName ?? r.updatedBy, updatedAt: now }
        : r
    ));
  }

  async function markRowDone(req: PLURequest) {
    const isBatch = req.id.includes(':');
    const batchId = isBatch ? req.id.split(':')[0] : null;
    const url = isBatch ? `/api/admin/batches/${batchId}/done` : `/api/admin/requests/${req.id}/done`;
    setMarkingDone(true);
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal'); }
      // Marking a batch item done completes the whole batch - reflect that across its rows.
      applyDoneLocally((r) => isBatch ? r.id.startsWith(`${batchId}:`) : r.id === req.id);
      fetchStats(); // keep the card counts in step with the row that just moved to Done
      toast.success('Permintaan ditandai selesai.');
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal menandai selesai.');
    } finally {
      setMarkingDone(false);
    }
  }

  async function bulkMarkDone() {
    const actionable = requests.filter((r) => selectedIds.has(r.id) && isAdminActionable(r.status));
    if (actionable.length === 0) return;
    const singleIds = actionable.filter((r) => !r.id.includes(':')).map((r) => r.id);
    const batchIds = Array.from(new Set(actionable.filter((r) => r.id.includes(':')).map((r) => r.id.split(':')[0])));
    setMarkingDone(true);
    try {
      const ops: Promise<Response>[] = [];
      if (singleIds.length > 0) {
        ops.push(fetch('/api/admin/bulk-done', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: singleIds }),
        }));
      }
      for (const bid of batchIds) ops.push(fetch(`/api/admin/batches/${bid}/done`, { method: 'POST' }));
      const results = await Promise.all(ops);
      if (results.some((r) => !r.ok)) throw new Error('Sebagian gagal');
      applyDoneLocally((r) => selectedIds.has(r.id) || batchIds.some((bid) => r.id.startsWith(`${bid}:`)));
      setSelectedIds(new Set());
      fetchStats();
      toast.success('Permintaan ditandai selesai.');
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal menandai selesai.');
    } finally {
      setMarkingDone(false);
    }
  }

  const selectedActionableCount = requests.filter((r) => selectedIds.has(r.id) && isAdminActionable(r.status)).length;

  // ── Price-levels side-export ────────────────────────────────────────────────
  // Separate from the 19-column file: this is the long-form ItemCode/SalesType/Outlets/Price
  // sheet the admin edits in Excel and re-imports, and it only exists for batch rows (the
  // endpoint is scoped to one RequestBatch).
  const batchIdsInScope = (() => {
    if (sourceFilter !== 'BATCH') return [];
    const scope = selectedIds.size > 0
      ? requests.filter((r) => selectedIds.has(r.id))
      : requests;
    return Array.from(new Set(scope.map((r) => r.id.split(':')[0]).filter(Boolean)));
  })();

  // Only knowable once the preview has loaded, since PriceLevels is a computed export column
  // rather than a field on the request row. Before then the button stays available and the
  // endpoint's 404 explains that the batch carries none.
  const previewLoadedForScope = previewMap.size > 0;
  const previewHasPriceLevels = Array.from(previewMap.values())
    .some((r) => String(r.PriceLevels ?? '').trim() !== '');
  const canExportPriceLevels = batchIdsInScope.length === 1
    && (!previewLoadedForScope || previewHasPriceLevels);

  async function downloadPriceLevels() {
    const batchId = batchIdsInScope[0];
    if (!batchId) return;
    setDownloadingPriceLevels(true);
    try {
      const res = await fetch(`/api/admin/requests/batch/${encodeURIComponent(batchId)}/export-price-levels`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Download failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'price-levels.xlsx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Deliberately does NOT touch export status: this sheet is a working file for editing
      // price levels, not the Quinos import, so it must not advance PENDING to EXPORTED.
      toast.success('Price levels XLSX downloaded.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to download price levels');
    } finally {
      setDownloadingPriceLevels(false);
    }
  }

  async function handleDownload(format: 'XLSX' | 'CSV') {
    const toDownload = selectedIds.size > 0 ? Array.from(selectedIds) : requests.map((r) => r.id);
    if (toDownload.length === 0) { toast.error('No items to export'); return; }

    const hasBatchItems = toDownload.some((id) => id.includes(':'));
    const hasSingleItems = toDownload.some((id) => !id.includes(':'));
    if (hasBatchItems && hasSingleItems) {
      toast.error('Mixed selection: filter by Source (Single Items or Batch Items) before exporting.');
      return;
    }

    setDownloadingFormat(format);
    try {
      const isBatchItem = hasBatchItems;

      const exportIds = isBatchItem
        ? Array.from(new Set(toDownload.map((id) => id.split(':')[0])))
        : toDownload;

      const params = new URLSearchParams({ ids: exportIds.join(',') });
      const isXLSX = format === 'XLSX';

      const apiPath = isBatchItem
        ? (isXLSX ? `/api/admin/export/batches/xlsx?${params}&type=${activeType}` : `/api/admin/export/batches/csv?${params}&type=${activeType}`)
        : (isXLSX ? `/api/admin/export/xlsx?${params}&type=${activeType}` : `/api/admin/export/csv?${params}&type=${activeType}`);

      const res = await fetch(apiPath);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Download failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `export.${format.toLowerCase()}`;

      // Some rows may export with blank master-sourced columns because their PLU code has no master
      // item match. The server flags those via X-Export-Warnings - surface it before the save so
      // the admin knows the file is incomplete (the download still proceeds).
      const warnRaw = res.headers.get('X-Export-Warnings');
      if (warnRaw) {
        try {
          const warn = JSON.parse(decodeURIComponent(warnRaw));
          if (warn?.type === 'MISSING_MASTER' && warn.count > 0) {
            const codes = (warn.rows as { code: string }[])
              .map((x) => x.code || '(tanpa kode)')
              .join(', ');
            toast.warning(
              `${warn.count} baris tanpa data master - kolom dari master dikosongkan: ${codes}`,
              { duration: 12000 },
            );
          }
        } catch { /* malformed header - ignore, file still downloads */ }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const plural = toDownload.length !== 1 ? 's' : '';
      if (format === 'XLSX' && activeType === 'NEW_ITEM') {
        toast.success(`XLSX downloaded: ${toDownload.length} item${plural}. Assign codes in Quinos, then mark as Done.`);
      } else {
        toast.success(`${format} downloaded: ${toDownload.length} item${plural}.`);
      }

      // Auto-advance downloaded PENDING items to EXPORTED. The file is already saved - never block
      // or reverse the download if this fails; just warn the admin to refresh.
      try {
        const markRes = await fetch('/api/admin/export/mark-exported', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: exportIds, type: isBatchItem ? 'batch' : 'single' }),
        });
        if (!markRes.ok) throw new Error('mark-exported failed');
        const now = new Date().toISOString();
        const exportedSet = new Set(exportIds);
        setRequests((prev) => prev.map((r) => {
          const recId = isBatchItem ? r.id.split(':')[0] : r.id;
          return exportedSet.has(recId) && r.status === 'PENDING'
            ? { ...r, status: 'EXPORTED', lastExportedBy: adminName ?? r.lastExportedBy ?? null, lastExportedAt: now, exportCount: (r.exportCount ?? 0) + 1 }
            : r;
        }));
        fetchStats(); // Pending → Exported on the cards, without a manual refresh
      } catch {
        toast.warning('Export berhasil diunduh, tetapi status gagal diperbarui. Refresh halaman untuk melihat status terbaru.');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setDownloadingFormat(null);
    }
  }
  const downloadCount = selectedIds.size > 0 ? selectedIds.size : requests.length;

  // Done items are paginated client-side; all other tabs render the full active queue.
  const isDoneView = statusFilter === 'DONE';
  const doneTotalPages = isDoneView ? Math.max(1, Math.ceil(requests.length / DONE_PAGE_SIZE)) : 1;
  const safeDonePage = Math.min(donePage, doneTotalPages);
  const visibleRequests = isDoneView
    ? requests.slice((safeDonePage - 1) * DONE_PAGE_SIZE, safeDonePage * DONE_PAGE_SIZE)
    : requests;

  return (
    <div style={{ maxWidth: '1080px' }}>
      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Export</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Export requests by type for processing or Quinos POS import.
      </p>

      {/* Source toggle - every stat and list on this page is scoped to the selected source. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Request Source:</span>
        {(['SINGLE', 'BATCH'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            style={{
              padding: '0.3rem 0.85rem',
              borderRadius: '3px',
              border: `1px solid ${sourceFilter === s ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: sourceFilter === s ? 'rgba(201,168,76,0.12)' : 'transparent',
              color: sourceFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.775rem',
              fontWeight: sourceFilter === s ? 600 : 400,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {s === 'SINGLE' && 'Single Items'}
            {s === 'BATCH' && <><Layers size={11} />Batch Items</>}
          </button>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
          Showing: <strong style={{ color: 'var(--text-primary)' }}>{SOURCE_LABELS[statsSource]}</strong>
          {group !== 'ALL' && <> · {group}</>}
          {(from || to) && <> · {from || '…'} – {to || '…'}</>}
        </span>
      </div>

      {/* Global filter bar */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        {/* Admin search - combines with source, type, status, group and date range. */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, PLU, barcode, outlet, requestor..."
            aria-label="Cari permintaan"
            style={{ ...SELECT_STYLE, cursor: 'text', width: '100%', padding: '0 1.9rem 0 1.8rem' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Hapus pencarian"
              style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.2rem' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select value={group} onChange={(e) => setGroup(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Groups</option>
          {outletGroups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={DATE_STYLE} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={DATE_STYLE} />
        </div>
        {(group !== 'ALL' || from || to || search) && (
          <button onClick={() => { setGroup('ALL'); setFrom(''); setTo(''); setSearch(''); }} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear
          </button>
        )}
      </div>

      {statsError && (
        <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1rem', borderLeft: '3px solid #8B3A2A', fontSize: '0.8rem', color: '#8B3A2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>Gagal memuat statistik kartu di bawah. Daftar permintaan tetap akurat.</span>
          <button onClick={fetchStats} style={{ fontSize: '0.78rem', color: '#8B3A2A', background: 'none', border: '1px solid #8B3A2A', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}>
            Coba lagi
          </button>
        </div>
      )}

      {/* Type cards - identical mini-stats on every card: Pending / Exported / Done / Total. */}
      <div className="type-card-grid">
        {TABS.map((tab) => {
          const isActive = activeType === tab.type;
          const s = statFor(tab.type);
          const rows: [string, number, string][] = [
            ['Pending', s.pending, STATUS_COLORS.PENDING],
            ['Exported', s.exported, STATUS_COLORS.EXPORTED],
            ['Done', s.done, STATUS_COLORS.DONE],
            ['Total', s.total, 'var(--text-secondary)'],
          ];
          return (
            <button
              key={tab.type}
              onClick={() => switchTab(tab.type)}
              aria-pressed={isActive}
              style={{
                padding: '0.875rem 1rem',
                border: isActive ? '2px solid var(--accent-gold)' : '1px solid var(--border)',
                borderRadius: '0.5rem',
                background: isActive ? 'rgba(201,168,76,0.07)' : 'var(--bg-card)',
                boxShadow: isActive ? '0 2px 10px rgba(201,168,76,0.22)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: tab.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <tab.Icon size={15} style={{ color: tab.color }} />
                </div>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.15rem 0.375rem', borderRadius: '3px', background: tab.format === 'XLSX' ? 'rgba(45,74,46,0.1)' : 'rgba(26,16,8,0.06)', color: tab.format === 'XLSX' ? '#2D4A2E' : 'var(--text-secondary)' }}>
                  {tab.format}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: isActive ? 700 : 500, color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                {tab.label}
              </div>
              {statsError ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Stats tidak tersedia</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.1rem' }}>
                  {rows.map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <span>{label}</span>
                      <span style={{ color, fontWeight: label === 'Pending' && value > 0 ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>
                        {stats ? value : '…'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {s.costControl > 0 && (
                <div style={{ fontSize: '0.66rem', color: '#7A2E1F', marginTop: '0.35rem' }}>
                  +{s.costControl} di cost control
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Panel header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <activeTab.Icon size={16} style={{ color: activeTab.color }} />
              <span className="section-title">{activeTab.label}</span>
            </div>
            {!loading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {requests.length} {sourceFilter === 'BATCH' ? 'batch item' : 'request'}{requests.length !== 1 ? 's' : ''}
                {' · '}{STATUS_TAB_LABELS[statusFilter]?.hint ?? statusFilter}
                {activeSearch && <> · pencarian &ldquo;{activeSearch}&rdquo;</>}
              </span>
            )}
          </div>
          {/* Status sub-filter - the list below always matches the selected view. */}
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {VALID_STATUSES.map((s) => {
              const count = s === 'PENDING' ? activeStat.pending
                : s === 'EXPORTED' ? activeStat.exported
                  : s === 'DONE' ? activeStat.done
                    : activeStat.total;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  title={STATUS_TAB_LABELS[s].hint}
                  style={{ padding: '0.25rem 0.625rem', borderRadius: '3px', border: `1px solid ${statusFilter === s ? 'var(--accent-gold)' : 'var(--border)'}`, background: statusFilter === s ? 'rgba(201,168,76,0.12)' : 'transparent', color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: statusFilter === s ? 600 : 400, cursor: 'pointer' }}
                >
                  {STATUS_TAB_LABELS[s].label}{stats ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* New Items callout */}
        {activeType === 'NEW_ITEM' && (
          <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(45,74,46,0.06)', borderBottom: '1px solid rgba(45,74,46,0.15)', fontSize: '0.8rem', color: '#2D4A2E', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>ℹ</span>
            <span>After downloading, assign PLU codes in Quinos, then mark requests as <strong>Done</strong> before exporting to CSV.</span>
          </div>
        )}

        {/* View toggle: operational table vs. full 19-column export preview */}
        {!loading && requests.length > 0 && (
          <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>View:</span>
            {([['TABLE', 'Table view'], ['PREVIEW', 'Export preview']] as const).map(([val, label]) => {
              const on = (val === 'PREVIEW') === previewMode;
              return (
                <button
                  key={val}
                  onClick={() => setPreviewMode(val === 'PREVIEW')}
                  style={{ padding: '0.25rem 0.75rem', borderRadius: '3px', border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border)'}`, background: on ? 'rgba(201,168,76,0.08)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.775rem', fontWeight: on ? 600 : 400, cursor: 'pointer' }}
                >
                  {label}
                </button>
              );
            })}
            {previewMode && previewLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />}
            {previewMode && (
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Pratinjau persis seperti isi file ekspor (19 kolom).
              </span>
            )}
          </div>
        )}

        {/* Action bar */}
        {!loading && requests.length > 0 && (
          <div style={{ padding: '0.625rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-cream)' }}>
            <input
              type="checkbox"
              checked={selectedIds.size === requests.length && requests.length > 0}
              onChange={toggleAll}
              style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${requests.length} item${requests.length !== 1 ? 's' : ''}`}
            </span>
            {selectedActionableCount > 0 && (
              <button
                onClick={bulkMarkDone}
                disabled={markingDone}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', background: 'rgba(61,90,62,0.1)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, color: '#2D4A2E', cursor: markingDone ? 'not-allowed' : 'pointer', opacity: markingDone ? 0.6 : 1 }}
              >
                <Check size={13} />
                Tandai Selesai ({selectedActionableCount})
              </button>
            )}
            {canExportPriceLevels && (
              <button
                onClick={downloadPriceLevels}
                disabled={downloadingPriceLevels}
                title="Download this batch's price levels as an editable sheet (ItemCode / SalesType / Outlets / Price)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: downloadingPriceLevels ? 'not-allowed' : 'pointer', opacity: downloadingPriceLevels ? 0.6 : 1 }}
              >
                {downloadingPriceLevels
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Download size={13} />}
                Export Price Levels
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {selectedIds.size === 0 ? 'Select rows or download all' : `Will export ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={6} cols={columns.length + 2} />
        ) : requests.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {activeSearch ? (
              <>
                <div style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Tidak ada permintaan {STATUS_TAB_LABELS[statusFilter].label.toLowerCase()} yang cocok dengan pencarian Anda.
                </div>
                <div>
                  {activeTab.label} · {SOURCE_LABELS[statsSource]} · pencarian &ldquo;{activeSearch}&rdquo;
                </div>
                <button
                  onClick={() => setSearch('')}
                  style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#8B6914', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}
                >
                  Hapus pencarian
                </button>
              </>
            ) : statusFilter === 'PENDING' ? (
              <>
                <div style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Tidak ada {activeTab.label} yang menunggu proses.
                </div>
                <div>
                  {activeStat.exported > 0 || activeStat.done > 0
                    ? <>Anda bisa memeriksa <strong>Exported ({activeStat.exported})</strong> atau <strong>Done ({activeStat.done})</strong>.</>
                    : <>Belum ada permintaan {activeTab.label} untuk filter ini.</>}
                </div>
              </>
            ) : (
              <>Tidak ada permintaan {activeTab.label} berstatus {STATUS_TAB_LABELS[statusFilter].label} untuk filter ini.</>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem' }}></th>
                  {previewMode
                    ? EXPORT_PREVIEW_COLUMNS.map((c) => <th key={c} style={{ whiteSpace: 'nowrap' }}>{c}</th>)
                    : columns.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => toggleOne(req.id)}
                    style={{ cursor: 'pointer', background: selectedIds.has(req.id) ? 'rgba(201,168,76,0.06)' : undefined }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleOne(req.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
                      />
                    </td>
                    {previewMode
                      ? EXPORT_PREVIEW_COLUMNS.map((c) => {
                        const pr = previewMap.get(req.id);
                        return (
                          <td key={c} style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: pr ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {previewCellText(pr, c)}
                          </td>
                        );
                      })
                      : columns.map((col) => <td key={col.key}>{col.render(req)}</td>)}
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {isAdminActionable(req.status) && (
                        <button
                          onClick={() => markRowDone(req)}
                          disabled={markingDone}
                          title="Tandai selesai"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'rgba(61,90,62,0.1)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '3px', cursor: markingDone ? 'not-allowed' : 'pointer', color: '#2D4A2E', opacity: markingDone ? 0.5 : 1 }}
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Done items pagination */}
        {!loading && isDoneView && (
          <DonePagination page={safeDonePage} totalPages={doneTotalPages} onPage={setDonePage} />
        )}

        {/* Bottom download bar */}
        {!loading && requests.length > 0 && (
          <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-cream)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `All ${requests.length} shown`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(activeType === 'NEW_ITEM' ? (['XLSX', 'CSV'] as const) : (['CSV', 'XLSX'] as const)).map((fmt) => {
                const isActive = downloadingFormat === fmt;
                const isDisabled = downloadingFormat !== null;
                const isXLSX = fmt === 'XLSX';
                return (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(fmt)}
                    disabled={isDisabled}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1.25rem',
                      background: isXLSX ? '#2D4A2E' : 'var(--bg-dark)',
                      color: isXLSX ? '#F0F7F0' : 'var(--accent-gold)',
                      border: 'none', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600,
                      cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.7 : 1,
                    }}
                  >
                    {isActive ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                    {isActive ? 'Downloading…' : `${fmt} (${downloadCount})`}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .type-card-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(2, 1fr);
          margin-bottom: 1.25rem;
        }
        @media (min-width: 720px) { .type-card-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1000px) { .type-card-grid { grid-template-columns: repeat(5, 1fr); } }
      `}</style>
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <ExportPageContent />
    </Suspense>
  );
}
