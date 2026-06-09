'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Filter, RefreshCw, X, Check, Download, Loader2 } from 'lucide-react';
import { formatTimestamp } from '@/lib/format';

interface RemovalRecord {
  id: string;
  status: string;
  outletGroup: string;
  cashierOutlet: string;
  code: string | null;
  name: string;
  folder: string | null;
  remarks: string | null;
  adminNote: string | null;
  createdAt: string;
  doneAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  submittedBy: { id: string; name: string; email: string; outlet: string };
}

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

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.625rem',
  fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

const DATE_INPUT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem',
  fontSize: '0.8rem', outline: 'none',
};

function StatusBadge({ status }: { status: string }) {
  const isPending = status === 'PENDING';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.55rem',
      borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: isPending ? 'rgba(184,134,11,0.1)' : 'rgba(61,90,62,0.1)',
      color: isPending ? '#8B6914' : '#2D4A2E',
      border: `1px solid ${isPending ? 'rgba(184,134,11,0.25)' : 'rgba(61,90,62,0.25)'}`,
    }}>
      {status}
    </span>
  );
}

const FALLBACK_GROUPS = ['UNION', 'CNS', 'FRENCH', 'IBR', 'IND'];

export default function AdminRemovalPage() {
  const [records, setRecords] = useState<RemovalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<RemovalRecord | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [marking, setMarking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ status: 'PENDING', outletGroup: 'ALL', from: '', to: '' });
  const [outletGroups, setOutletGroups] = useState<string[]>(FALLBACK_GROUPS);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.outletGroup !== 'ALL') params.set('outletGroup', filters.outletGroup);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`/api/removal?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecords(data.requests ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Gagal memuat data removal request');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    fetch('/api/config/outlets?activeOnly=true')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { group: string }[] | null) => {
        if (!data) return;
        const groups = Array.from(new Set(data.map((o) => o.group))).sort();
        if (groups.length > 0) setOutletGroups(groups);
      })
      .catch(() => {});
  }, []);

  function openSlideOver(rec: RemovalRecord) {
    setActiveRecord(rec);
    setActiveId(rec.id);
    setAdminNote(rec.adminNote ?? '');
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
      const res = await fetch(`/api/removal/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE', adminNote: adminNote || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ditandai sebagai selesai');
      closeSlideOver();
      fetchRecords();
    } catch {
      toast.error('Gagal menandai selesai');
    } finally {
      setMarking(false);
    }
  }

  async function saveNote() {
    if (!activeId) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/removal/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: adminNote || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Catatan disimpan');
      fetchRecords();
    } catch {
      toast.error('Gagal menyimpan catatan');
    } finally {
      setMarking(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.outletGroup !== 'ALL') params.set('outletGroup', filters.outletGroup);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`/api/removal/export?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `removal-requests-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Gagal mengekspor data');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = filters.status !== 'PENDING' || filters.outletGroup !== 'ALL' || !!filters.from || !!filters.to;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Request Removal</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Memuat...' : `${total} removal request`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: (exporting || loading) ? 'not-allowed' : 'pointer', opacity: (exporting || loading) ? 0.5 : 1 }}
          >
            <Download size={13} />
            Export
          </button>
          <button
            onClick={fetchRecords}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={SELECT_STYLE}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="DONE">Done</option>
        </select>
        <select value={filters.outletGroup} onChange={(e) => setFilters((f) => ({ ...f, outletGroup: e.target.value }))} style={SELECT_STYLE}>
          <option value="ALL">All Groups</option>
          {outletGroups.map((g) => <option key={g} value={g}>{g}</option>)}
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
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Tidak ada removal request.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Outlet / By</th>
                  <th>PLU Code</th>
                  <th style={{ minWidth: '160px' }}>Item Name</th>
                  <th>Folder</th>
                  <th style={{ minWidth: '180px' }}>Remarks</th>
                  <th>Status</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} style={{ cursor: 'pointer' }} onClick={() => openSlideOver(rec)}>
                    <td style={{ minWidth: '130px' }}>
                      <div style={{ fontSize: '0.8rem' }}>{formatTimestamp(rec.createdAt).split(', ')[0]}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(rec.createdAt).split(', ')[1]}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 500 }}>{rec.cashierOutlet}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{rec.submittedBy?.name ?? ''}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9A84C', fontWeight: 600 }}>
                        {rec.code ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.name || '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rec.folder ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.remarks ?? '—'}
                    </td>
                    <td>
                      <StatusBadge status={rec.status} />
                      <AuditLine by={rec.updatedBy} at={rec.updatedAt} />
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); openSlideOver(rec); }}>
                      <button style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Slide-over */}
      {activeId && activeRecord && (
        <>
          <div onClick={closeSlideOver} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '95vw', background: 'var(--bg-card)', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Removal Request</h2>
              <button onClick={closeSlideOver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem' }}>
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
                { label: 'PLU Code', value: activeRecord.code ?? '-', mono: true },
                { label: 'Item Name', value: activeRecord.name || '-' },
                { label: 'Folder', value: activeRecord.folder ?? '-' },
                { label: 'Alasan Penghapusan', value: activeRecord.remarks ?? '-' },
                { label: 'Submitted By', value: `${activeRecord.submittedBy?.name ?? ''} (${activeRecord.cashierOutlet})` },
                { label: 'Submitted On', value: formatTimestamp(activeRecord.createdAt) },
                ...(activeRecord.doneAt ? [{ label: 'Done On', value: formatTimestamp(activeRecord.doneAt) }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ marginBottom: '0.875rem' }}>
                  <div className="label-caps" style={{ marginBottom: '0.2rem' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', fontFamily: mono ? 'monospace' : undefined, color: mono ? '#C9A84C' : 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}

              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <div className="label-caps" style={{ marginBottom: '0.5rem' }}>Admin Note</div>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Tambahkan catatan..."
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
                    Simpan Catatan
                  </button>
                  {activeRecord.status === 'PENDING' && (
                    <button
                      onClick={markDone}
                      disabled={marking}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', background: 'rgba(61,90,62,0.12)', border: '1px solid rgba(61,90,62,0.3)', borderRadius: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: marking ? 'not-allowed' : 'pointer', color: '#2D4A2E' }}
                    >
                      <Check size={13} />
                      Tandai Selesai
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
