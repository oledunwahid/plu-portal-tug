'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import { PlusCircle, Pencil, Lock, Layers, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  UPDATE_FULL: 'Full Update',
};

interface SingleRequest {
  id: string;
  requestType: string;
  status: string;
  name: string;
  category: string;
  price: number | null;
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
  const [loading, setLoading] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/batches'),
      ]);
      if (sRes.ok) setSingles((await sRes.json()).map((r: any) => ({ ...r, _source: 'single' })));
      if (bRes.ok) setBatches((await bRes.json()).map((b: any) => ({ ...b, _source: 'batch' })));
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchAll();
  }, [status, fetchAll]);

  if (status === 'loading') return null;

  const allRows: DashboardRow[] = [
    ...singles,
    ...batches,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalCount = allRows.length;

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
                  <th>Price</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => {
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
                        <td style={{ fontSize: '0.8rem' }}>{req.price ? formatPrice(req.price) : '—'}</td>
                        <td>
                          <div className={req.status === 'PENDING' ? 'pending-badge-live' : undefined} style={{ display: 'inline-block' }}>
                            <StatusBadge status={req.status} />
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.adminNote ?? '—'}
                        </td>
                        <td>
                          {req.status === 'PENDING' ? (
                            <Link
                              href={`/cashier/request/edit/${req.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.45rem', textDecoration: 'none' }}
                            >
                              <Pencil size={11} /> Edit
                            </Link>
                          ) : (
                            <span title="Request has been processed" style={{ cursor: 'help', color: 'var(--text-secondary)', display: 'inline-flex', padding: '0.2rem' }}>
                              <Lock size={12} />
                            </span>
                          )}
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
                      <td style={{ fontSize: '0.8rem' }}>—</td>
                      <td>
                        <div className={batch.status === 'PENDING' ? 'pending-badge-live' : undefined} style={{ display: 'inline-block' }}>
                          <StatusBadge status={batch.status} />
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {batch.adminNote ?? '—'}
                      </td>
                      <td>
                        {batch.status === 'PENDING' ? (
                          <Link
                            href={`/cashier/request/batch/edit/${batch.id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.2rem 0.45rem', textDecoration: 'none' }}
                          >
                            <Pencil size={11} /> Edit
                          </Link>
                        ) : (
                          <span title="Batch has been processed" style={{ cursor: 'help', color: 'var(--text-secondary)', display: 'inline-flex', padding: '0.2rem' }}>
                            <Lock size={12} />
                          </span>
                        )}
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`b-${batch.id}-expanded`} style={{ background: 'rgba(201,168,76,0.02)' }}>
                        <td colSpan={9} style={{ padding: '0 1.5rem 0.75rem 2.5rem' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Name</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Category</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Price</th>
                                <th style={{ fontSize: '0.65rem', textAlign: 'left', padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Code</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.items.map((item) => (
                                <tr key={item.id}>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>{item.name}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                                  <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}>{item.price ? formatPrice(item.price) : '—'}</td>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
