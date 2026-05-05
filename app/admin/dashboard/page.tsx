'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import StatusBadge, { TypeBadge } from '@/components/StatusBadge';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import { Filter, CheckSquare, RefreshCw, Pencil, Check, Trash2, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import RequestSlideOver from '@/components/RequestSlideOver';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import StatCardSkeleton from '@/components/skeletons/StatCardSkeleton';

interface Request {
  id: string;
  requestType: string;
  status: string;
  name: string;
  category: string;
  price: number | null;
  outletGroup: string;
  cashierOutlet: string;
  createdAt: string;
  submittedBy: { name: string; outlet: string };
}

interface BatchItem {
  id: string; name: string; category: string; price: number | null; code: string | null;
}
interface BatchRow {
  id: string;
  title: string;
  requestType: string;
  status: string;
  outletGroup: string;
  cashierOutlet: string;
  createdAt: string;
  items: BatchItem[];
  submittedBy: { name: string; outlet: string };
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '1.125rem 1.375rem' }}>
      <div className="label-caps" style={{ marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.875rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: accent ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

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

const DATE_INPUT_STYLE = {
  height: '34px',
  borderRadius: '0.375rem',
  border: '1px solid var(--input-border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '0 0.5rem',
  fontSize: '0.8rem',
  outline: 'none',
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [metrics, setMetrics] = useState<{ newItems: number; updatePrice: number; updateName: number; updatePrinter: number; totalDone: number } | null>(null);
  const [metricsFrom, setMetricsFrom] = useState('');
  const [metricsTo, setMetricsTo] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SINGLE' | 'BATCH'>('ALL');
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [markingBatchId, setMarkingBatchId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    status: 'PENDING',
    outletGroup: 'ALL',
    requestType: 'ALL',
    from: '',
    to: '',
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.outletGroup !== 'ALL') params.set('outletGroup', filters.outletGroup);
      if (filters.requestType !== 'ALL') params.set('requestType', filters.requestType);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const fetches: Promise<void>[] = [];

      if (sourceFilter !== 'BATCH') {
        fetches.push(
          fetch(`/api/admin/requests?${params}`)
            .then((r) => r.json())
            .then((data) => { setRequests(data); setSelected(new Set()); })
            .catch(() => { toast.error('Failed to load requests'); })
        );
      } else {
        setRequests([]);
        setSelected(new Set());
      }

      if (sourceFilter !== 'SINGLE') {
        const bParams = new URLSearchParams(params);
        fetches.push(
          fetch(`/api/admin/batches?${bParams}`)
            .then((r) => r.json())
            .then((data) => setBatches(Array.isArray(data) ? data : []))
            .catch(() => {})
        );
      } else {
        setBatches([]);
      }

      await Promise.all(fetches);
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [filters, sourceFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    async function fetchMetrics() {
      const params = new URLSearchParams();
      if (metricsFrom) params.set('from', metricsFrom);
      if (metricsTo) params.set('to', metricsTo);
      const res = await fetch(`/api/admin/metrics?${params}`);
      if (res.ok) setMetrics(await res.json());
    }
    fetchMetrics();
  }, [metricsFrom, metricsTo]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === requests.length ? new Set() : new Set(requests.map((r) => r.id)));
  }

  async function bulkDone() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/bulk-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Marked ${data.updated} request${data.updated !== 1 ? 's' : ''} as done`);
      fetchRequests();
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  }

  async function bulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selected).map((id) => fetch(`/api/admin/requests/${id}`, { method: 'DELETE' })));
      toast.success(`Deleted ${selected.size} request${selected.size !== 1 ? 's' : ''}`);
      setBulkDeleteConfirm(false);
      fetchRequests();
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkLoading(false);
    }
  }

  async function markDone(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}/done`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Marked as done');
      fetchRequests();
    } catch {
      toast.error('Failed to mark done');
    } finally {
      setMarkingId(null);
    }
  }

  async function markBatchDone(batch: BatchRow) {
    setMarkingBatchId(batch.id);
    try {
      const res = await fetch(`/api/admin/batches/${batch.id}/done`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(`Batch marked as done — ${batch.items.length} item${batch.items.length !== 1 ? 's' : ''}`);
      fetchRequests();
    } catch {
      toast.error('Failed to mark batch done');
    } finally {
      setMarkingBatchId(null);
    }
  }

  function toggleBatchExpand(id: string) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteRequest(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Request deleted');
      setDeleteConfirmId(null);
      fetchRequests();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const doneCount = requests.filter((r) => r.status === 'DONE').length;
  const newItemCount = requests.filter((r) => r.requestType === 'NEW_ITEM').length;

  const hasFilters = filters.status !== 'PENDING' || filters.outletGroup !== 'ALL' || filters.requestType !== 'ALL' || !!filters.from || !!filters.to;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${requests.length} shown`}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI metrics */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="label-caps">All-Time Statuses</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <input type="date" value={metricsFrom} onChange={(e) => setMetricsFrom(e.target.value)} style={{ height: '28px', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.4rem', fontSize: '0.75rem', outline: 'none' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>–</span>
            <input type="date" value={metricsTo} onChange={(e) => setMetricsTo(e.target.value)} style={{ height: '28px', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.4rem', fontSize: '0.75rem', outline: 'none' }} />
            {(metricsFrom || metricsTo) && <button onClick={() => { setMetricsFrom(''); setMetricsTo(''); }} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'New Items', value: metrics?.newItems },
            { label: 'Price Updates', value: metrics?.updatePrice },
            { label: 'Name Updates', value: metrics?.updateName },
            { label: 'Printer Updates', value: metrics?.updatePrinter },
            { label: 'Total Done', value: metrics?.totalDone, accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ textAlign: 'center', padding: '0.625rem', borderRadius: '6px', background: 'var(--bg-cream)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.375rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: accent ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1 }}>
                {value ?? '—'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <StatCardSkeleton />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
          <StatCard label="Shown" value={requests.length} />
          <StatCard label="Pending" value={pendingCount} accent={pendingCount > 0} />
          <StatCard label="Done" value={doneCount} />
          <StatCard label="New Items" value={newItemCount} />
        </div>
      )}

      {/* Source toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>Source:</span>
        {(['ALL', 'SINGLE', 'BATCH'] as const).map((s) => (
          <button key={s} onClick={() => setSourceFilter(s)}
            style={{ padding: '0.25rem 0.75rem', borderRadius: '3px', border: `1px solid ${sourceFilter === s ? 'var(--accent-gold)' : 'var(--border)'}`, background: sourceFilter === s ? 'rgba(201,168,76,0.08)' : 'transparent', color: sourceFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: sourceFilter === s ? 600 : 400, cursor: 'pointer' }}>
            {s === 'ALL' ? 'All' : s === 'SINGLE' ? 'Single' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Layers size={11} /> Batch</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />

        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={SELECT_STYLE}>
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DONE">Done</option>
        </select>

        <select value={filters.outletGroup} onChange={(e) => setFilters((f) => ({ ...f, outletGroup: e.target.value }))} style={SELECT_STYLE}>
          <option value="ALL">All Groups</option>
          <option value="UNION">Union</option>
          <option value="CNS">CNS</option>
          <option value="FRENCH">French</option>
          <option value="IBR">IBR</option>
        </select>

        <select value={filters.requestType} onChange={(e) => setFilters((f) => ({ ...f, requestType: e.target.value }))} style={SELECT_STYLE}>
          <option value="ALL">All Types</option>
          <option value="NEW_ITEM">New Item</option>
          <option value="UPDATE_PRICE">Update Price</option>
          <option value="UPDATE_NAME">Update Name</option>
          <option value="UPDATE_PRINTER">Chg Printer</option>
          <option value="UPDATE_FULL">Full Update</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} style={DATE_INPUT_STYLE} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>–</span>
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} style={DATE_INPUT_STYLE} />
        </div>

        {hasFilters && (
          <button
            onClick={() => setFilters({ status: 'PENDING', outletGroup: 'ALL', requestType: 'ALL', from: '', to: '' })}
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Reset
          </button>
        )}
      </div>


      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : requests.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No requests found for the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={selected.size === requests.length && requests.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
                    />
                  </th>
                  <th>Date</th>
                  <th>Group</th>
                  <th>Outlet / By</th>
                  <th>Type</th>
                  <th>Item Name</th>
                  <th>Status</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ padding: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
                      />
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(req.createdAt).split(', ')[0]}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(req.createdAt).split(', ')[1]}</div>
                    </td>
                    <td>
                      <span style={{ background: 'var(--bg-cream)', border: '1px solid var(--border)', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {req.outletGroup}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 500 }}>{req.cashierOutlet}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{req.submittedBy.name}</div>
                    </td>
                    <td>
                      <TypeBadge type={req.requestType} />
                    </td>
                    <td style={{ fontWeight: 500, maxWidth: '200px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontSize: '0.875rem' }}>
                        {req.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{req.category}</span>
                    </td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td>
                      {deleteConfirmId === req.id ? (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            onClick={() => deleteRequest(req.id)}
                            disabled={deletingId === req.id}
                            style={{ padding: '0.2rem 0.5rem', background: '#7A2E1F', color: 'white', border: 'none', borderRadius: '3px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            {deletingId === req.id ? '…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            style={{ padding: '0.2rem 0.4rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            onClick={() => setActiveId(req.id)}
                            title="Edit"
                            style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                          >
                            <Pencil size={12} />
                          </button>
                          {req.status === 'PENDING' && (
                            <button
                              onClick={() => markDone(req.id)}
                              disabled={markingId === req.id}
                              title="Mark Done"
                              style={{ padding: '0.25rem 0.5rem', background: 'rgba(61,90,62,0.1)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '3px', cursor: markingId === req.id ? 'not-allowed' : 'pointer', color: '#2D4A2E', display: 'flex', alignItems: 'center' }}
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirmId(req.id)}
                            title="Delete"
                            style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid rgba(139,58,42,0.2)', borderRadius: '3px', cursor: 'pointer', color: '#7A2E1F', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected.size > 0 && <div style={{ height: '64px' }} />}

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div
          className="bulk-bar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#1A1008',
            zIndex: 30,
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderTop: '1px solid rgba(201,168,76,0.2)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
            {selected.size} selected
          </span>

          <button
            onClick={bulkDone}
            disabled={bulkLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: bulkLoading ? 'not-allowed' : 'pointer' }}
          >
            <CheckSquare size={13} />
            Mark {selected.size} as Done
          </button>

          {bulkDeleteConfirm ? (
            <>
              <button
                onClick={bulkDelete}
                disabled={bulkLoading}
                style={{ padding: '0.45rem 0.875rem', background: '#7A2E1F', color: 'white', border: 'none', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: bulkLoading ? 'not-allowed' : 'pointer' }}
              >
                {bulkLoading ? '…' : `Confirm Delete ${selected.size}`}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                style={{ padding: '0.45rem 0.75rem', background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              style={{ padding: '0.45rem 0.875rem', background: 'rgba(122,46,31,0.3)', color: '#E8917A', border: '1px solid rgba(122,46,31,0.4)', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Delete {selected.size}
            </button>
          )}

          <button
            onClick={() => { setSelected(new Set()); setBulkDeleteConfirm(false); }}
            style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Batch rows (shown outside main card for simplicity, appended after) */}
      {batches.length > 0 && sourceFilter !== 'SINGLE' && (
        <div className="card" style={{ overflow: 'hidden', marginTop: '0.875rem' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={13} style={{ color: '#8B6914' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Batch Requests</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{batches.length} shown</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '24px' }}></th>
                  <th>Date</th>
                  <th>Group</th>
                  <th>Outlet / By</th>
                  <th>Type</th>
                  <th>Batch Title</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const isExpanded = expandedBatches.has(batch.id);
                  return [
                    <tr key={`ab-${batch.id}`} style={{ background: isExpanded ? 'rgba(201,168,76,0.03)' : undefined }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button onClick={() => toggleBatchExpand(batch.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td style={{ minWidth: '130px' }}>
                        <div style={{ fontSize: '0.8rem' }}>{formatTimestamp(batch.createdAt).split(', ')[0]}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(batch.createdAt).split(', ')[1]}</div>
                      </td>
                      <td>
                        <span style={{ background: 'var(--bg-cream)', border: '1px solid var(--border)', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{batch.outletGroup}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 500 }}>{batch.cashierOutlet}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{batch.submittedBy.name}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: '#8B6914', background: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' }}>
                          {batch.requestType.replace('_', ' ')} · {batch.items.length} items
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '0.875rem', maxWidth: '220px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{batch.title}</span>
                      </td>
                      <td><StatusBadge status={batch.status} /></td>
                      <td>
                        {batch.status === 'PENDING' && (
                          <button
                            onClick={() => markBatchDone(batch)}
                            disabled={markingBatchId === batch.id}
                            title="Mark all items done"
                            style={{ padding: '0.25rem 0.5rem', background: 'rgba(61,90,62,0.1)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '3px', cursor: markingBatchId === batch.id ? 'not-allowed' : 'pointer', color: '#2D4A2E', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`ab-${batch.id}-exp`} style={{ background: 'rgba(201,168,76,0.02)' }}>
                        <td colSpan={8} style={{ padding: '0 1.5rem 0.75rem 2.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {['Name', 'Category', 'Price', 'Code'].map((h) => (
                                  <th key={h} style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {batch.items.map((item) => (
                                <tr key={item.id}>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>{item.name}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>{item.price != null ? `Rp ${item.price.toLocaleString()}` : '—'}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{item.code ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RequestSlideOver
        requestId={activeId}
        onClose={() => setActiveId(null)}
        onUpdate={fetchRequests}
      />
    </div>
  );
}
