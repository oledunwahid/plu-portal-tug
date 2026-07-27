'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Loader2, CheckCircle, XCircle, ClipboardCheck, RefreshCw } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { formatTimestamp } from '@/lib/format';
import { CORK_OUTLETS } from '@/lib/outlets';
import StatusBadge from '@/components/StatusBadge';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

interface CCRequest {
  id: string;
  status: string;
  name: string;
  category: string;
  department: string;
  price: number | null;
  folder: string | null;
  printers: string;
  outlets: string;
  cashierOutlet: string;
  createdAt: string;
  updatedAt: string;
  suggestedBarcode: string | null;
  suggestedBarcodeSource: string | null;
  confirmedBarcode: string | null;
  adminNote: string | null;
  submittedBy: { name: string; outlet: string };
}

type Tab = 'QUEUE' | 'HISTORY';

const fmtList = (v: string) => (v ? v.replace(/;/g, ' · ') : '—');

function dateParts(iso: string): [string, string] {
  const full = formatTimestamp(iso);
  const [d, t] = full.split(', ');
  return [d ?? full, t ?? ''];
}

// ── Review slide-over ─────────────────────────────────────────────────────────
function ReviewPanel({
  request, onClose, onDone,
}: {
  request: CCRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [barcode, setBarcode] = useState(request.suggestedBarcode ?? '');
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);

  async function handleConfirm() {
    setBusy('confirm');
    try {
      const res = await fetch(`/api/cost-control/requests/${request.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBarcode: barcode.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal'); }
      toast.success('Dikonfirmasi - diteruskan ke admin.');
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal mengonfirmasi.');
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!reason.trim()) { toast.error('Alasan penolakan harus diisi.'); return; }
    setBusy('reject');
    try {
      const res = await fetch(`/api/cost-control/requests/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal'); }
      toast.success('Permintaan ditolak - kasir diberi tahu.');
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal menolak.');
    } finally {
      setBusy(null);
    }
  }

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div className="label-caps" style={{ marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: '500px', maxWidth: '100vw', background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right 250ms ease',
      }}>
        {/* Header */}
        <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="section-title">Review · {request.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.875rem', background: 'var(--bg-cream)', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Oleh: </span><span style={{ fontWeight: 500 }}>{request.submittedBy.name}</span></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Outlet: </span><span style={{ fontWeight: 500 }}>{request.cashierOutlet}</span></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-secondary)' }}>Dikirim: </span>{formatTimestamp(request.createdAt)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <Field label="Name" value={request.name} />
            <Field label="Category" value={request.category} />
            <Field label="Department" value={request.department} />
            <Field label="Price" value={request.price ? formatPrice(request.price) : '—'} />
            <Field label="Folder" value={request.folder ?? '—'} />
            <Field label="Printers" value={fmtList(request.printers)} />
            <div style={{ gridColumn: '1 / -1' }}><Field label="Outlets" value={fmtList(request.outlets)} /></div>
          </div>

          {/* Suggested barcode - editable. The source label tells cost control whether the value
              came from a real SAP NCK match or is a system-generated sequential guess. */}
          <div>
            <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>
              Suggested Barcode
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="field-input"
              placeholder={request.suggestedBarcode ? 'Masukkan barcode…' : 'TIDAK DITEMUKAN - ISI MANUAL'}
              style={{ fontFamily: 'monospace' }}
            />
            {/* Always show a guidance line: the source label when a value was suggested,
                otherwise an explicit manual-entry notice so the field is never silent. */}
            <div style={{
              marginTop: '0.3rem', fontSize: '0.72rem',
              color: request.suggestedBarcodeSource === 'Dari SAP NCK' ? '#2D4A2E'
                : request.suggestedBarcodeSource ? '#8B6914' : '#A33',
            }}>
              {request.suggestedBarcodeSource ?? 'TIDAK DITEMUKAN - ISI MANUAL'}
            </div>
          </div>

          {/* Reject reason - revealed on demand */}
          {showReject && (
            <div>
              <label className="label-caps" style={{ display: 'block', marginBottom: '0.3rem' }}>Alasan Penolakan (wajib)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan penolakan - akan terlihat oleh kasir."
                style={{ width: '100%', border: '1px solid var(--input-border)', borderRadius: '4px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontFamily: 'var(--font-body)', resize: 'vertical', outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-card)', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button onClick={handleConfirm} disabled={busy !== null} className="btn-primary" style={{ flex: 1 }}>
            {busy === 'confirm' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
            {busy === 'confirm' ? 'Menyimpan…' : 'Confirm'}
          </button>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              disabled={busy !== null}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', background: 'rgba(180,35,24,0.08)', color: '#B42318', border: '1px solid rgba(180,35,24,0.3)', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
            >
              <XCircle size={13} /> Reject
            </button>
          ) : (
            <button
              onClick={handleReject}
              disabled={busy !== null}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', background: '#B42318', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy === 'reject' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
              {busy === 'reject' ? 'Menolak…' : 'Konfirmasi Tolak'}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function CostControlDashboard() {
  const [tab, setTab] = useState<Tab>('QUEUE');
  const [queue, setQueue] = useState<CCRequest[]>([]);
  const [history, setHistory] = useState<CCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CCRequest | null>(null);

  // History filters.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outlet, setOutlet] = useState('ALL');

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cost-control/queue', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setQueue(await res.json());
    } catch {
      toast.error('Gagal memuat antrian.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (outlet !== 'ALL') params.set('outlet', outlet);
      const res = await fetch(`/api/cost-control/history?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setHistory(await res.json());
    } catch {
      toast.error('Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }, [from, to, outlet]);

  useEffect(() => {
    if (tab === 'QUEUE') fetchQueue();
    else fetchHistory();
  }, [tab, fetchQueue, fetchHistory]);

  function handleReviewDone() {
    setActive(null);
    fetchQueue();
  }

  const rows = tab === 'QUEUE' ? queue : history;

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.375rem' }}>
        <ClipboardCheck size={20} style={{ color: 'var(--accent-gold)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>Cost Control</h1>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Tinjau item WINE baru dari outlet Cork - konfirmasi barcode lalu teruskan ke admin.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {([['QUEUE', 'Antrian'], ['HISTORY', 'Riwayat']] as const).map(([val, label]) => {
          const on = tab === val;
          return (
            <button
              key={val}
              onClick={() => setTab(val)}
              style={{ padding: '0.4rem 1rem', borderRadius: '4px', border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border)'}`, background: on ? 'rgba(201,168,76,0.08)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: on ? 600 : 400, cursor: 'pointer' }}
            >
              {label}{val === 'QUEUE' && queue.length > 0 ? ` (${queue.length})` : ''}
            </button>
          );
        })}
        <button
          onClick={() => (tab === 'QUEUE' ? fetchQueue() : fetchHistory())}
          disabled={loading}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* History filter bar */}
      {tab === 'HISTORY' && (
        <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} style={{ height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.625rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}>
            <option value="ALL">Semua Outlet</option>
            {CORK_OUTLETS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem', fontSize: '0.8rem', outline: 'none' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem', fontSize: '0.8rem', outline: 'none' }} />
          </div>
          {(outlet !== 'ALL' || from || to) && (
            <button onClick={() => { setOutlet('ALL'); setFrom(''); setTo(''); }} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={6} cols={tab === 'QUEUE' ? 6 : 6} />
        ) : rows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {tab === 'QUEUE' ? 'Tidak ada permintaan menunggu review.' : 'Belum ada riwayat untuk filter ini.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Oleh</th>
                  <th>Dikirim</th>
                  <th>Barcode</th>
                  {tab === 'QUEUE' ? <th style={{ textAlign: 'center' }}>Aksi</th> : <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const [d, t] = dateParts(r.createdAt);
                  const barcode = r.confirmedBarcode ?? r.suggestedBarcode;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{r.name}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.category}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{r.submittedBy.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{r.cashierOutlet}</div>
                      </td>
                      <td style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{d}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: barcode ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {barcode || '—'}
                      </td>
                      {tab === 'QUEUE' ? (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setActive(r)}
                            style={{ padding: '0.3rem 0.85rem', background: 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Review
                          </button>
                        </td>
                      ) : (
                        <td>
                          <StatusBadge status={r.status} />
                          {r.status === 'REJECTED' && r.adminNote && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '220px' }}>
                              {r.adminNote}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && <ReviewPanel request={active} onClose={() => setActive(null)} onDone={handleReviewDone} />}
    </div>
  );
}
