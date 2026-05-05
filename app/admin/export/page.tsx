'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { PlusCircle, Tag, Type, Printer, Download, Loader2, Layers } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

type RequestType = 'NEW_ITEM' | 'UPDATE_PRICE' | 'UPDATE_NAME' | 'UPDATE_PRINTER';

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
  submittedBy: { name: string; outlet: string };
}

interface TabConfig {
  type: RequestType;
  label: string;
  Icon: React.ElementType;
  color: string;
  lightColor: string;
  format: 'XLSX' | 'CSV';
  defaultStatus: string;
}

const TABS: TabConfig[] = [
  { type: 'NEW_ITEM', label: 'New Items', Icon: PlusCircle, color: '#2D4A2E', lightColor: 'rgba(45,74,46,0.12)', format: 'XLSX', defaultStatus: 'PENDING' },
  { type: 'UPDATE_PRICE', label: 'Update Price', Icon: Tag, color: '#8B6914', lightColor: 'rgba(139,105,20,0.12)', format: 'CSV', defaultStatus: 'ALL' },
  { type: 'UPDATE_NAME', label: 'Update Name', Icon: Type, color: '#7A2E1F', lightColor: 'rgba(122,46,31,0.12)', format: 'CSV', defaultStatus: 'ALL' },
  { type: 'UPDATE_PRINTER', label: 'Update Printer', Icon: Printer, color: '#1F3A5F', lightColor: 'rgba(31,58,95,0.12)', format: 'CSV', defaultStatus: 'ALL' },
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

type ColumnDef = { key: string; label: string; render: (r: PLURequest) => React.ReactNode };

const COLUMNS: Record<RequestType, ColumnDef[]> = {
  NEW_ITEM: [
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'category', label: 'Category', render: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.category}</span> },
    { key: 'dept', label: 'Department', render: (r) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.department}</span> },
    { key: 'price', label: 'Price', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.price ? formatPrice(r.price) : '—'}</span> },
    { key: 'folder', label: 'Folder', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.folder ?? '—'}</span> },
    { key: 'printers', label: 'Printers', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.printers.replace(/;/g, ' · ')}</span> },
    { key: 'outlets', label: 'Outlets', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.outlets.replace(/;/g, ' · ')}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ],
  UPDATE_PRICE: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'price', label: 'New Price', render: (r) => <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.price ? formatPrice(r.price) : '—'}</span> },
    { key: 'outlet', label: 'Outlet', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ],
  UPDATE_NAME: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'New Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'category', label: 'Category', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.category}</span> },
    { key: 'outlet', label: 'Outlet', render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.cashierOutlet}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ],
  UPDATE_PRINTER: [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.code ?? '—'}</span> },
    { key: 'name', label: 'Item Name', render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: 'printers', label: 'New Printers', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.printers.replace(/;/g, ' · ')}</span> },
    { key: 'outlets', label: 'Outlets', render: (r) => <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.outlets.replace(/;/g, ' · ')}</span> },
    { key: 'by', label: 'By', render: (r) => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.submittedBy.name}</span> },
    { key: 'date', label: 'Date', render: (r) => <div style={{ minWidth: '130px' }}><div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(r.createdAt).split(', ')[0]}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(r.createdAt).split(', ')[1]}</div></div> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ],
};

export default function ExportPage() {
  const [activeType, setActiveType] = useState<RequestType>('NEW_ITEM');
  const [group, setGroup] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [requests, setRequests] = useState<PLURequest[]>([]);
  const [tabCounts, setTabCounts] = useState<Partial<Record<RequestType, number>>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'SINGLE' | 'BATCH' | 'ALL'>('ALL');

  const activeTab = TABS.find((t) => t.type === activeType)!;
  const columns = COLUMNS[activeType];

  // Fetch counts for all tabs when global filters change
  useEffect(() => {
    async function fetchCounts() {
      const results = await Promise.all(
        TABS.map(async (tab) => {
          const params = new URLSearchParams({ requestType: tab.type, status: tab.defaultStatus, countOnly: '1' });
          if (group !== 'ALL') params.set('outletGroup', group);
          if (from) params.set('from', from);
          if (to) params.set('to', to);
          try {
            const res = await fetch(`/api/admin/requests?${params}`);
            const data = res.ok ? await res.json() : {};
            return [tab.type, typeof data.count === 'number' ? data.count : 0] as const;
          } catch {
            return [tab.type, 0] as const;
          }
        })
      );
      setTabCounts(Object.fromEntries(results));
    }
    fetchCounts();
  }, [group, from, to]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ requestType: activeType });
      if (group !== 'ALL') params.set('outletGroup', group);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      function flattenBatches(batchData: any[]): any[] {
        return batchData.flatMap((b: any) =>
          (b.items as any[]).map((item: any) => ({
            ...item,
            id: `${b.id}:${item.id}`,
            requestType: b.requestType,
            status: b.status,
            cashierOutlet: b.cashierOutlet,
            outletGroup: b.outletGroup,
            createdAt: b.createdAt,
            submittedBy: b.submittedBy,
          }))
        );
      }

      if (sourceFilter === 'ALL') {
        const [sRes, bRes] = await Promise.all([
          fetch(`/api/admin/requests?${params}`),
          fetch(`/api/admin/batches?${params}`),
        ]);
        const singles = sRes.ok ? await sRes.json() : [];
        const batches = bRes.ok ? flattenBatches(await bRes.json()) : [];
        const merged = [...singles, ...batches].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRequests(merged as any);
      } else if (sourceFilter === 'BATCH') {
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
  }, [activeType, group, statusFilter, from, to, sourceFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  function switchTab(type: RequestType) {
    const tab = TABS.find((t) => t.type === type)!;
    setActiveType(type);
    setStatusFilter(tab.defaultStatus);
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

  async function handleDownload() {
    const toDownload = selectedIds.size > 0 ? Array.from(selectedIds) : requests.map((r) => r.id);
    if (toDownload.length === 0) { toast.error('No items to export'); return; }

    const hasBatchItems = toDownload.some((id) => id.includes(':'));
    const hasSingleItems = toDownload.some((id) => !id.includes(':'));
    if (hasBatchItems && hasSingleItems) {
      toast.error('Mixed selection detected — filter by Source (Single or Batch) before exporting.');
      return;
    }

    setDownloading(true);
    try {
      const isBatchItem = hasBatchItems;

      const exportIds = isBatchItem
        ? Array.from(new Set(toDownload.map((id) => id.split(':')[0])))
        : toDownload;

      const params = new URLSearchParams({ ids: exportIds.join(',') });
      const isXLSX = activeTab.format === 'XLSX';

      // Route to the correct endpoint based on the data type detected above
      const apiPath = isBatchItem
        ? (isXLSX ? `/api/admin/export/batches/xlsx?${params}` : `/api/admin/export/batches/csv?${params}&type=${activeType}`)
        : (isXLSX ? `/api/admin/export/xlsx?${params}` : `/api/admin/export/csv?${params}&type=${activeType}`);

      const res = await fetch(apiPath);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Download failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `export.${activeTab.format.toLowerCase()}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (isXLSX) {
        toast.success(`XLSX downloaded — ${toDownload.length} items. Assign codes in Quinos, then mark as Done.`);
      } else {
        toast.success(`CSV downloaded — ${toDownload.length} items exported to Quinos format.`);
      }
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setDownloading(false);
    }
  }
  const downloadCount = selectedIds.size > 0 ? selectedIds.size : requests.length;

  return (
    <div style={{ maxWidth: '1080px' }}>
      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Export</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Export requests by type for processing or Quinos POS import.
      </p>

      {/* Source toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Request Source:</span>
        {(['SINGLE', 'BATCH', 'ALL'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '3px',
              border: `1px solid ${sourceFilter === s ? 'var(--accent-gold)' : 'var(--border)'}`,
              background: sourceFilter === s ? 'rgba(201,168,76,0.08)' : 'transparent',
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
            {s === 'ALL' && 'All'}
          </button>
        ))}
      </div>

      {/* Global filter bar */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <select value={group} onChange={(e) => setGroup(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Groups</option>
          <option value="UNION">Union</option>
          <option value="CNS">CNS</option>
          <option value="FRENCH">French</option>
          <option value="IBR">IBR</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={DATE_STYLE} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={DATE_STYLE} />
        </div>
        {(group !== 'ALL' || from || to) && (
          <button onClick={() => { setGroup('ALL'); setFrom(''); setTo(''); }} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear
          </button>
        )}
      </div>

      {/* Tab strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {TABS.map((tab) => {
          const isActive = activeType === tab.type;
          const count = tabCounts[tab.type];
          return (
            <button
              key={tab.type}
              onClick={() => switchTab(tab.type)}
              style={{
                padding: '0.875rem 1rem',
                border: isActive ? '2px solid var(--accent-gold)' : '1px solid var(--border)',
                borderRadius: '0.5rem',
                background: isActive ? 'rgba(201,168,76,0.04)' : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: tab.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <tab.Icon size={15} style={{ color: tab.color }} />
                </div>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.15rem 0.375rem', borderRadius: '3px', background: tab.format === 'XLSX' ? 'rgba(45,74,46,0.1)' : 'rgba(26,16,8,0.06)', color: tab.format === 'XLSX' ? '#2D4A2E' : 'var(--text-secondary)' }}>
                  {tab.format}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                {tab.label}
              </div>
              {count !== undefined && (
                <div style={{ fontSize: '0.75rem', color: count > 0 ? tab.color : 'var(--text-secondary)', fontWeight: count > 0 ? 600 : 400 }}>
                  {count} {tab.defaultStatus.toLowerCase()}
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
                {requests.length} request{requests.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Status sub-filter */}
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {(['PENDING', 'DONE', 'ALL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '3px', border: `1px solid ${statusFilter === s ? 'var(--accent-gold)' : 'var(--border)'}`, background: statusFilter === s ? 'rgba(201,168,76,0.08)' : 'transparent', color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: statusFilter === s ? 600 : 400, cursor: 'pointer' }}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* New Items callout */}
        {activeType === 'NEW_ITEM' && (
          <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(45,74,46,0.06)', borderBottom: '1px solid rgba(45,74,46,0.15)', fontSize: '0.8rem', color: '#2D4A2E', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>ℹ</span>
            <span>After downloading, assign PLU codes in Quinos, then mark requests as <strong>Done</strong> before exporting to CSV.</span>
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
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {selectedIds.size === 0 ? 'Select rows or download all' : `Will export ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={6} cols={columns.length + 1} />
        ) : requests.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No {activeTab.label.toLowerCase()} requests found for the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem' }}></th>
                  {columns.map((col) => <th key={col.key}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
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
                    {columns.map((col) => <td key={col.key}>{col.render(req)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom download bar */}
        {!loading && requests.length > 0 && (
          <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-cream)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `All ${requests.length} shown`}
            </span>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                background: activeTab.format === 'XLSX' ? '#2D4A2E' : 'var(--bg-dark)',
                color: activeTab.format === 'XLSX' ? '#F0F7F0' : 'var(--accent-gold)',
                border: 'none', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600,
                cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
              {downloading ? 'Downloading…' : `Download ${activeTab.format} (${downloadCount})`}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
