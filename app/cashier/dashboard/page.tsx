'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import { PlusCircle, Pencil, Lock, Layers, ChevronDown, ChevronRight, ChevronLeft, Loader2, Tag, Search, Trash2, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  UPDATE_FULL: 'Full Update',
  REMOVE_PLU: 'Remove PLU',
};

// Cashiers don't see the internal EXPORTED state - it reads as PENDING until admin marks it DONE.
// PENDING_COST_CONTROL is also surfaced as plain PENDING (the cost-control approval stage was removed),
// so it shows the normal pending badge and stays editable. REJECTED is surfaced verbatim (distinct
// badge) and locks the Edit button, since the edit/live-badge logic only treats a literal 'PENDING'
// as editable.
const toCashierStatus = (s: string): string => {
  if (s === 'DONE') return 'DONE';
  if (s === 'REJECTED') return 'REJECTED';
  return 'PENDING';
};

// Outlets are stored as a semicolon-joined string on each request/batch item.
function splitOutlets(raw: string | null | undefined): string[] {
  return (raw ?? '').split(';').map((s) => s.trim()).filter(Boolean);
}
function formatOutlets(raw: string | null | undefined): string {
  const list = splitOutlets(raw);
  return list.length ? list.join(', ') : '—';
}
// Aggregate the distinct outlets applied across every row of a batch. When all
// rows share one outlet it collapses to that single value; differing rows show
// the distinct codes comma-separated (e.g. "BLCS, CSPP").
function formatBatchOutlets(items: BatchItem[]): string {
  const distinct = Array.from(new Set(items.flatMap((i) => splitOutlets(i.outlets))));
  return distinct.length ? distinct.join(', ') : '—';
}

interface DiscountRequest {
  id: string;
  buttonName: string;
  discountType: string;
  discountValue: number;
  discountValueType: string;
  status: string;
  createdAt: string;
}

interface SingleRequest {
  id: string;
  requestType: string;
  status: string;
  name: string;
  category: string;
  price: number | null;
  outlets: string | null;
  adminNote: string | null;
  createdAt: string;
  _source: 'single';
}

interface BatchItem {
  id: string;
  name: string;
  category: string;
  price: number | null;
  code: string | null;
  outlets: string | null;
  remarks: string | null;
}

interface BatchRequest {
  id: string;
  title: string;
  requestType: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  items: BatchItem[];
  _source: 'batch';
}

type DashboardRow = SingleRequest | BatchRequest;

export default function CashierDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [singles, setSingles] = useState<SingleRequest[]>([]);
  const [batches, setBatches] = useState<BatchRequest[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Search / filter / pagination for the requests table.
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE' | 'REJECTED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<DashboardRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Any filter change resets to the first page so the view never lands on an empty page.
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes, dRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/batches'),
        fetch('/api/discount'),
      ]);
      if (sRes.ok) setSingles((await sRes.json()).map((r: any) => ({ ...r, _source: 'single' })));
      if (bRes.ok) setBatches((await bRes.json()).map((b: any) => ({ ...b, _source: 'batch' })));
      if (dRes.ok) setDiscounts(await dRes.json());
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchAll();
  }, [status, fetchAll]);

  async function handleDelete() {
    if (!confirmDelete) return;
    const row = confirmDelete;
    setDeleting(true);
    try {
      const url = row._source === 'single' ? `/api/requests/${row.id}` : `/api/batches/${row.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      if (row._source === 'single') setSingles((prev) => prev.filter((s) => s.id !== row.id));
      else setBatches((prev) => prev.filter((b) => b.id !== row.id));
      toast.success('Request deleted');
      setConfirmDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (status === 'loading') return null;

  const allRows: DashboardRow[] = [
    ...singles,
    ...batches,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalCount = allRows.length;

  // Apply the status/type filters and free-text search, then page the result 10 at a time.
  const q = search.trim().toLowerCase();
  const filteredRows = allRows.filter((row) => {
    if (statusFilter !== 'ALL' && toCashierStatus(row.status) !== statusFilter) return false;
    if (typeFilter !== 'ALL' && row.requestType !== typeFilter) return false;
    if (!q) return true;
    const parts: string[] = [TYPE_LABELS[row.requestType] ?? row.requestType];
    if (row._source === 'single') {
      const r = row as SingleRequest;
      parts.push(r.name, r.category, r.outlets ?? '');
    } else {
      const b = row as BatchRequest;
      parts.push(b.title, formatBatchOutlets(b.items));
      for (const it of b.items) parts.push(it.name, it.category, it.code ?? '');
    }
    return parts.join(' ').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleExpand(id: string) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title">My Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${totalCount} total submission${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <Link
            href="/cashier/request/new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.5rem 1.125rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}
          >
            <PlusCircle size={15} />
            New Request
          </Link>
          <Link
            href="/cashier/request/batch/new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', padding: '0.5rem 1.125rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}
          >
            <Layers size={15} />
            New Batch
          </Link>
        </div>
      </div>

      {!loading && allRows.length > 0 && (
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, category, outlet, code…"
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} title="Clear" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.15rem' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="DONE">Done</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
          >
            <option value="ALL">All types</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {filteredRows.length} result{filteredRows.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: 'var(--text-secondary)' }} />
        </div>
      ) : allRows.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            You haven't submitted any requests yet.
          </p>
          <Link
            href="/cashier/request/new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', padding: '0.5rem 1.125rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}
          >
            <PlusCircle size={15} />
            Submit your first request
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '24px' }}></th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item / Batch</th>
                  <th>Category</th>
                  <th>Outlets</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      No requests match your search or filters.
                    </td>
                  </tr>
                )}
                {pagedRows.map((row) => {
                  if (row._source === 'single') {
                    const req = row as SingleRequest;
                    return (
                      <tr key={`s-${req.id}`}>
                        <td></td>
                        <td style={{ minWidth: '130px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(req.createdAt).split(', ')[0]}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(req.createdAt).split(', ')[1]}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' }}>
                              {TYPE_LABELS[req.requestType] ?? req.requestType}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)', border: '1px solid var(--border)', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>Single</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{req.name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{req.category}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatOutlets(req.outlets)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{req.price ? formatPrice(req.price) : '—'}</td>
                        <td>
                          <div className={toCashierStatus(req.status) === 'PENDING' ? 'pending-badge-live' : undefined} style={{ display: 'inline-block' }}>
                            <StatusBadge status={toCashierStatus(req.status)} />
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.adminNote ?? '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {toCashierStatus(req.status) === 'PENDING' && (
                              <Link
                                href={`/cashier/request/edit/${req.id}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.45rem', textDecoration: 'none' }}
                              >
                                <Pencil size={11} /> Edit
                              </Link>
                            )}
                            {toCashierStatus(req.status) === 'DONE' && (
                              <span title="Request has been processed" style={{ cursor: 'help', color: 'var(--text-secondary)', display: 'inline-flex', padding: '0.2rem' }}>
                                <Lock size={12} />
                              </span>
                            )}
                            {toCashierStatus(req.status) !== 'DONE' && (
                              <button
                                onClick={() => setConfirmDelete(req)}
                                title="Delete request"
                                style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.25rem', cursor: 'pointer', color: '#8B3A2A' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Batch row
                  const batch = row as BatchRequest;
                  const isExpanded = expandedBatches.has(batch.id);
                  return [
                    <tr key={`b-${batch.id}`} style={{ background: isExpanded ? 'rgba(201,168,76,0.03)' : undefined }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button onClick={() => toggleExpand(batch.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 0 }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td style={{ minWidth: '130px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{formatTimestamp(batch.createdAt).split(', ')[0]}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(batch.createdAt).split(', ')[1]}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' }}>
                            {TYPE_LABELS[batch.requestType] ?? batch.requestType}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#8B6914', background: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' }}>
                            Batch · {batch.items.length}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{batch.title}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatBatchOutlets(batch.items)}>{formatBatchOutlets(batch.items)}</td>
                      <td style={{ fontSize: '0.8rem' }}>—</td>
                      <td>
                        <div className={toCashierStatus(batch.status) === 'PENDING' ? 'pending-badge-live' : undefined} style={{ display: 'inline-block' }}>
                          <StatusBadge status={toCashierStatus(batch.status)} />
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {batch.adminNote ?? '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {toCashierStatus(batch.status) === 'PENDING' && (
                            <Link
                              href={`/cashier/request/batch/edit/${batch.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.45rem', textDecoration: 'none' }}
                            >
                              <Pencil size={11} /> Edit
                            </Link>
                          )}
                          {toCashierStatus(batch.status) === 'DONE' && (
                            <span title="Batch has been processed" style={{ cursor: 'help', color: 'var(--text-secondary)', display: 'inline-flex', padding: '0.2rem' }}>
                              <Lock size={12} />
                            </span>
                          )}
                          {toCashierStatus(batch.status) !== 'DONE' && (
                            <button
                              onClick={() => setConfirmDelete(batch)}
                              title="Delete batch"
                              style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.25rem', cursor: 'pointer', color: '#8B3A2A' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`b-${batch.id}-expanded`} style={{ background: 'rgba(201,168,76,0.02)' }}>
                        <td colSpan={10} style={{ padding: '0 1.5rem 0.75rem 2.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Name</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Category</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Price</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Outlets</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Code</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.items.map((item) => (
                                <tr key={item.id}>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>{item.name}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>{item.price ? formatPrice(item.price) : '—'}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatOutlets(item.outlets)}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{item.code ?? '—'}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.remarks?.trim() ? item.remarks : '—'}</td>
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
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Page {safePage} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.3rem 0.6rem', background: 'var(--bg-card)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.3rem 0.6rem', background: 'var(--bg-card)', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          onClick={() => !deleting && setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: '400px', width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
              <AlertTriangle size={20} style={{ color: '#8B3A2A' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Delete this request?</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              {confirmDelete._source === 'single'
                ? `"${(confirmDelete as SingleRequest).name}" will be permanently removed.`
                : `Batch "${(confirmDelete as BatchRequest).title}" and its ${(confirmDelete as BatchRequest).items.length} item${(confirmDelete as BatchRequest).items.length !== 1 ? 's' : ''} will be permanently removed.`}
              {' '}This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.5rem 1rem', background: 'var(--bg-card)', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.5rem 1rem', background: '#8B3A2A', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Requests Section */}
      {discounts.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginTop: '1.5rem' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={13} style={{ color: '#8B6914' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>My Discount Requests</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{discounts.length}</span>
            </div>
            <Link href="/cashier/discount/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.5rem', textDecoration: 'none' }}>
              <PlusCircle size={11} /> New
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Button Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((dr) => (
                  <tr key={dr.id}>
                    <td style={{ minWidth: '120px' }}>
                      <div style={{ fontSize: '0.8rem' }}>{formatTimestamp(dr.createdAt).split(', ')[0]}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(dr.createdAt).split(', ')[1]}</div>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{dr.buttonName}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {dr.discountType === 'FIXED_AMOUNT' ? 'Nominal' : 'Persentase'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {dr.discountValueType === 'IDR'
                        ? `Rp ${dr.discountValue.toLocaleString('id-ID')}`
                        : `${dr.discountValue}%`}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '0.25rem',
                        fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: dr.status === 'PENDING' ? 'rgba(184,134,11,0.1)' : 'rgba(61,90,62,0.1)',
                        color: dr.status === 'PENDING' ? '#8B6914' : '#2D4A2E',
                        border: `1px solid ${dr.status === 'PENDING' ? 'rgba(184,134,11,0.25)' : 'rgba(61,90,62,0.25)'}`,
                      }}>
                        {dr.status}
                      </span>
                    </td>
                    <td>
                      {dr.status === 'PENDING' ? (
                        <Link href={`/cashier/discount/edit/${dr.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.45rem', textDecoration: 'none' }}>
                          <Pencil size={11} /> Edit
                        </Link>
                      ) : (
                        <span title="Processed" style={{ cursor: 'help', color: 'var(--text-secondary)', display: 'inline-flex', padding: '0.2rem' }}>
                          <Lock size={12} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {discounts.length === 0 && !loading && (
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No discount requests yet</span>
          </div>
          <Link href="/cashier/discount/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.3rem 0.625rem', textDecoration: 'none' }}>
            <PlusCircle size={12} /> New Discount Request
          </Link>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
