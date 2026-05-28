'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Filter, RefreshCw, Check, X, CheckSquare, Loader2 } from 'lucide-react';
import { formatTimestamp } from '@/lib/format';

interface DiscountRecord {
  id: string;
  status: string;
  outletGroup: string;
  cashierOutlet: string;
  buttonName: string;
  discountType: string;
  discountValue: number;
  discountValueType: string;
  outlets: string;
  applicableTo: string;
  conditions: string | null;
  remarks: string | null;
  adminNote: string | null;
  createdAt: string;
  doneAt: string | null;
  submittedBy: { name: string; outlet: string };
}

const SELECT_STYLE = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.625rem',
  fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

const DATE_INPUT_STYLE = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem',
  fontSize: '0.8rem', outline: 'none',
};

function formatDiscountValue(record: DiscountRecord): string {
  if (record.discountValueType === 'IDR') {
    return `Rp ${record.discountValue.toLocaleString('id-ID')}`;
  }
  return `${record.discountValue}%`;
}

function StatusBadge({ status }: { status: string }) {
  const isPending = status === 'PENDING';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: isPending ? 'rgba(184,134,11,0.1)' : 'rgba(61,90,62,0.1)',
      color: isPending ? '#8B6914' : '#2D4A2E',
      border: `1px solid ${isPending ? 'rgba(184,134,11,0.25)' : 'rgba(61,90,62,0.25)'}`,
    }}>
      {status}
    </span>
  );
}

export default function AdminDiscountPage() {
  const [records, setRecords] = useState<DiscountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<DiscountRecord | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [marking, setMarking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [filters, setFilters] = useState({ status: 'PENDING', outletGroup: 'ALL', from: '', to: '' });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.outletGroup !== 'ALL') params.set('outletGroup', filters.outletGroup);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`/api/discount?${params}`);
      if (!res.ok) throw new Error();
      setRecords(await res.json());
      setSelected(new Set());
    } catch {
      toast.error('Failed to load discount requests');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function openSlideOver(record: DiscountRecord) {
    setActiveRecord(record);
    setActiveId(record.id);
    setAdminNote(record.adminNote ?? '');
  }

  function closeSlideOver() {
    setActiveId(null);
    setActiveRecord(null);
    setAdminNote('');
  }

  async function markDone() {
    if (!activeId) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/discount/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE', adminNote: adminNote || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Marked as done');
      closeSlideOver();
      fetchRecords();
    } catch {
      toast.error('Failed to mark done');
    } finally {
      setMarking(false);
    }
  }

  async function saveNote() {
    if (!activeId) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/discount/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: adminNote || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Note saved');
      fetchRecords();
    } catch {
      toast.error('Failed to save note');
    } finally {
      setMarking(false);
    }
  }

  async function bulkMarkDone() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const results = await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/discount/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'DONE' }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      const succeeded = results.length - failed;
      if (succeeded > 0) toast.success(`Marked ${succeeded} request${succeeded !== 1 ? 's' : ''} as done`);
      if (failed > 0) toast.error(`${failed} failed`);
      fetchRecords();
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pendingIds = records.filter((r) => r.status === 'PENDING').map((r) => r.id);
    setSelected(selected.size === pendingIds.length && pendingIds.length > 0 ? new Set() : new Set(pendingIds));
  }

  const pendingRecords = records.filter((r) => r.status === 'PENDING');
  const hasFilters = filters.status !== 'PENDING' || filters.outletGroup !== 'ALL' || !!filters.from || !!filters.to;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Discount Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Loading...' : `${records.length} shown`}
          </p>
        </div>
        <button
          onClick={fetchRecords}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
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
          <option value="IND">IND</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} style={DATE_INPUT_STYLE} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>-</span>
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} style={DATE_INPUT_STYLE} />
        </div>
        {hasFilters && (
          <button onClick={() => setFilters({ status: 'PENDING', outletGroup: 'ALL', from: '', to: '' })} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No discount requests found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={selected.size === pendingRecords.length && pendingRecords.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
                    />
                  </th>
                  <th>Date</th>
                  <th>Group</th>
                  <th>Outlet / By</th>
                  <th>Button Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Conditions</th>
                  <th>Status</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} style={{ cursor: 'pointer' }} onClick={() => openSlideOver(rec)}>
                    <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                      {rec.status === 'PENDING' && (
                        <input
                          type="checkbox"
                          checked={selected.has(rec.id)}
                          onChange={() => toggleSelect(rec.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--bg-dark)' }}
                        />
                      )}
                    </td>
                    <td style={{ minWidth: '130px' }}>
                      <div style={{ fontSize: '0.8rem' }}>{formatTimestamp(rec.createdAt).split(', ')[0]}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(rec.createdAt).split(', ')[1]}</div>
                    </td>
                    <td>
                      <span style={{ background: 'var(--bg-cream)', border: '1px solid var(--border)', borderRadius: '0.25rem', padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {rec.outletGroup}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 500 }}>{rec.cashierOutlet}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{rec.submittedBy.name}</div>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: '0.875rem', maxWidth: '180px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{rec.buttonName}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {rec.discountType === 'FIXED_AMOUNT' ? 'Nominal' : 'Persentase'}
                    </td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {formatDiscountValue(rec)}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.conditions ?? '—'}
                    </td>
                    <td>
                      <StatusBadge status={rec.status} />
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); openSlideOver(rec); }}>
                      <button
                        style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && <div style={{ height: '64px' }} />}
      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1A1008', zIndex: 30, padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid rgba(201,168,76,0.2)' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>{selected.size} selected</span>
          <button
            onClick={bulkMarkDone}
            disabled={bulkLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', background: 'var(--accent-gold)', color: '#1A1008', border: 'none', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: bulkLoading ? 'not-allowed' : 'pointer' }}
          >
            <CheckSquare size={13} />
            Mark {selected.size} as Done
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear selection
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Slide-over */}
      {activeId && activeRecord && (
        <>
          <div onClick={closeSlideOver} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '95vw', background: 'var(--bg-card)', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Discount Request</h2>
              <button onClick={closeSlideOver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <StatusBadge status={activeRecord.status} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                  {activeRecord.outletGroup}
                </span>
              </div>

              {[
                { label: 'Button Name', value: activeRecord.buttonName },
                { label: 'Discount Type', value: activeRecord.discountType === 'FIXED_AMOUNT' ? 'Nominal Tetap' : 'Persentase' },
                { label: 'Discount Value', value: formatDiscountValue(activeRecord) },
                { label: 'Applicable To', value: activeRecord.applicableTo },
                { label: 'Outlets', value: activeRecord.outlets ? activeRecord.outlets.split(';').filter(Boolean).join(', ') : '-' },
                { label: 'Conditions', value: activeRecord.conditions ?? '-' },
                { label: 'Submitted By', value: `${activeRecord.submittedBy.name} (${activeRecord.cashierOutlet})` },
                { label: 'Submitted On', value: formatTimestamp(activeRecord.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: '0.875rem' }}>
                  <div className="label-caps" style={{ marginBottom: '0.2rem' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}

              {activeRecord.remarks && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <div className="label-caps" style={{ marginBottom: '0.2rem' }}>Remarks</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{activeRecord.remarks}</div>
                </div>
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <div className="label-caps" style={{ marginBottom: '0.5rem' }}>Admin Note</div>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note for the cashier..."
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={saveNote}
                    disabled={marking}
                    style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: marking ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                  >
                    Save Note
                  </button>
                  {activeRecord.status === 'PENDING' && (
                    <button
                      onClick={markDone}
                      disabled={marking}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', background: 'rgba(61,90,62,0.12)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: marking ? 'not-allowed' : 'pointer', color: '#2D4A2E' }}
                    >
                      <Check size={13} />
                      Mark as Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
