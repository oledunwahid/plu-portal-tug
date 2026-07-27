'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Upload, ArrowLeftRight, Loader2, Download, AlertCircle, History, Filter, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

// All parsing, matching, bridge lookup and export now run server-side (see
// app/api/admin/kb/reconcile/*). This page is just the shell: it uploads the file,
// lets the admin pick a past session, drives filters, and renders the persisted rows.

interface SessionSummary {
  id: string; label: string; uploadedAt: string; department: string;
  total: number; matched: number; notInCloud: number; priceMismatch: number;
}

interface ReconcileRow {
  id: string; fisikCode: string; fisikName: string; fisikPrice: number | null; fisikQty: number | null;
  codeType: string; matchedMasterCode: string | null; matchedMasterName: string | null;
  matchedMasterPrice: number | null; matchConfidence: string; matchMethod: string;
  priceMatch: boolean | null; subGroup: string | null; priceDiff: number | null;
}

interface NotInFisikMaster {
  code: string; name: string; price: number | null; outlets: string | null; category: string;
}

interface Filters {
  confidence: string; priceMatch: string; codeType: string;
  subGroup: string; priceDiffMin: string; priceDiffMax: string; search: string;
}

const DEPARTMENTS = ['WINE', 'ALCOHOLIC BEVERAGES', 'NON ALCOHOLIC BEVERAGES', 'ALL'];
const EMPTY_FILTERS: Filters = { confidence: '', priceMatch: '', codeType: '', subGroup: '', priceDiffMin: '', priceDiffMax: '', search: '' };

const AMBER_BG = 'rgba(251,191,36,0.1)';

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.5rem', fontSize: '0.78rem', cursor: 'pointer', outline: 'none',
};
const INPUT_STYLE: React.CSSProperties = { ...SELECT_STYLE, cursor: 'text', width: '110px' };

const METHOD_LABEL: Record<string, string> = {
  BARCODE_DIRECT: 'Barcode', SAP_NCK_DERIVED: 'SAP→NCK', XEVLA_BRIDGE: 'XEVLA→SAP',
  SAP_PREFIX: 'SAP prefix', NAME_FUZZY: 'Nama mirip', NONE: '—',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

type TabKey = 'cocok' | 'cloud' | 'fisik';

// Build the shared query string from the active filters for the rows/export routes.
function filterQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.confidence) p.set('confidence', f.confidence);
  if (f.priceMatch) p.set('priceMatch', f.priceMatch);
  if (f.codeType) p.set('codeType', f.codeType);
  if (f.subGroup) p.set('subGroup', f.subGroup);
  if (f.priceDiffMin) p.set('priceDiffMin', f.priceDiffMin);
  if (f.priceDiffMax) p.set('priceDiffMax', f.priceDiffMax);
  if (f.search) p.set('search', f.search);
  return p.toString();
}

export default function ReconcilePage() {
  // COST_CONTROL has read-only access - the upload control is hidden (session viewing stays).
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN';
  const [department, setDepartment] = useState('WINE');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabKey>('cocok');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<ReconcileRow[]>([]);
  const [notInFisik, setNotInFisik] = useState<NotInFisikMaster[]>([]);
  const [notInFisikCount, setNotInFisikCount] = useState<number | null>(null);
  const [subGroups, setSubGroups] = useState<string[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [exporting, setExporting] = useState(false);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/kb/reconcile/sessions');
      if (!res.ok) throw new Error('Gagal memuat daftar sesi');
      const data = await res.json();
      setSessions((data.sessions ?? []) as SessionSummary[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat sesi');
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      toast.error('Hanya file .xlsx atau .csv yang didukung.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('department', department);
      fd.append('label', file.name);
      const res = await fetch('/api/admin/kb/reconcile/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload gagal');
      const s = data.summary;
      toast.success(`${s.total} baris diproses · ${s.matched} cocok · ${s.notInCloud} tidak di cloud${s.masterSheetFound ? ` · bridge +${s.bridgeInserted}/~${s.bridgeUpdated}` : ' · sheet Master tidak ditemukan'}`);
      await fetchSessions();
      setFilters(EMPTY_FILTERS);
      setTab('cocok');
      setActiveId(data.sessionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengunggah file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Fetch the rows / not-in-fisik for the active session whenever the session, tab
  // or filters change. Debounced so typing in the search box doesn't spam the API.
  useEffect(() => {
    if (!activeId) { setRows([]); setNotInFisik([]); setSubGroups([]); return; }
    const handle = setTimeout(async () => {
      setLoadingRows(true);
      try {
        if (tab === 'fisik') {
          const p = new URLSearchParams();
          if (filters.subGroup) p.set('subGroup', filters.subGroup);
          if (filters.search) p.set('search', filters.search);
          const res = await fetch(`/api/admin/kb/reconcile/${activeId}/not-in-fisik?${p}`);
          if (!res.ok) throw new Error('Gagal memuat data');
          const data = await res.json();
          setNotInFisik((data.masters ?? []) as NotInFisikMaster[]);
        } else {
          const p = new URLSearchParams(filterQuery(filters));
          p.set('tab', tab === 'cocok' ? 'matched' : 'not_in_cloud');
          const res = await fetch(`/api/admin/kb/reconcile/${activeId}/rows?${p}`);
          if (!res.ok) throw new Error('Gagal memuat data');
          const data = await res.json();
          setRows((data.rows ?? []) as ReconcileRow[]);
          setSubGroups((data.subGroups ?? []) as string[]);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat baris');
      } finally {
        setLoadingRows(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [activeId, tab, filters]);

  // Unfiltered not-in-fisik count for the summary card (separate from the tab view).
  useEffect(() => {
    if (!activeId) { setNotInFisikCount(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/kb/reconcile/${activeId}/not-in-fisik?countOnly=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNotInFisikCount(Number(data.count ?? 0));
      } catch { /* card just shows - */ }
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  async function handleExport() {
    if (!activeId) return;
    setExporting(true);
    try {
      const q = filterQuery(filters);
      const res = await fetch(`/api/admin/kb/reconcile/${activeId}/export${q ? `?${q}` : ''}`);
      if (!res.ok) throw new Error('Export gagal');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const m = disposition.match(/filename="(.+?)"/);
      downloadBlob(blob, m?.[1] ?? `rekonsiliasi-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('XLSX diunduh');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengekspor');
    } finally {
      setExporting(false);
    }
  }

  function setFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clickPriceMismatchCard() {
    setTab('cocok');
    setFilters({ ...EMPTY_FILTERS, priceMatch: 'false' });
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const TABS: { key: TabKey; label: string; count: number | null }[] = [
    { key: 'cocok', label: 'Cocok', count: active?.matched ?? null },
    { key: 'cloud', label: 'Tidak di Cloud', count: active?.notInCloud ?? null },
    { key: 'fisik', label: 'Tidak di Fisik', count: notInFisikCount },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ArrowLeftRight size={22} style={{ color: '#C9A84C' }} />
          <h1 className="page-title">Rekonsiliasi Stok</h1>
        </div>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Bandingkan data fisik toko dengan Master Item Registry. Pencocokan, bridge SAP↔XEVLA↔NCK, dan ekspor diproses di server.
        </p>
      </div>

      {/* Upload + session selector */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Upload controls - admin only (cost control views sessions read-only). */}
        {isAdmin && (<>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Upload File Fisik Toko</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', maxWidth: '560px' }}>
                Sheet pertama = stok fisik (Item Code, Item Name, Price, Qty). Sheet «Master» (opsional) = bridge SAP↔XEVLA↔NCK.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label-caps" style={{ fontSize: '0.62rem' }}>Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={SELECT_STYLE}>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#C9A84C' : 'var(--border)'}`,
              borderRadius: '8px', padding: '1.5rem', textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer', background: dragOver ? 'rgba(201,168,76,0.04)' : 'transparent',
              transition: 'all 150ms',
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.875rem' }}>Mengunggah & mencocokkan di server…</span>
              </div>
            ) : (
              <>
                <Upload size={20} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Klik untuk unggah atau seret file ke sini</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>.xlsx atau .csv · ditandai sebagai «{department}»</div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </>)}

        {/* Session selector */}
        {sessions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
            <History size={14} style={{ color: 'var(--text-secondary)' }} />
            <label className="label-caps" style={{ fontSize: '0.62rem' }}>Sesi sebelumnya</label>
            <select value={activeId ?? ''} onChange={(e) => { setActiveId(e.target.value || null); setFilters(EMPTY_FILTERS); setTab('cocok'); }} style={{ ...SELECT_STYLE, minWidth: '320px', flex: '0 1 auto' }}>
              <option value="">- pilih sesi —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.uploadedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · {s.label} · [{s.department}] · {s.total} baris
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {active && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
            {[
              { label: 'Item fisik', value: active.total, color: 'var(--text-primary)', onClick: undefined },
              { label: 'Cocok', value: active.matched, color: '#2D4A2E', onClick: () => { setTab('cocok'); setFilters(EMPTY_FILTERS); } },
              { label: 'Tidak di cloud', value: active.notInCloud, color: '#7A2E1F', onClick: () => { setTab('cloud'); setFilters(EMPTY_FILTERS); } },
              { label: 'Tidak di fisik', value: notInFisikCount ?? '…', color: '#7A2E1F', onClick: () => { setTab('fisik'); setFilters(EMPTY_FILTERS); } },
              { label: 'Selisih harga', value: active.priceMismatch, color: '#8B6914', onClick: clickPriceMismatchCard },
            ].map((c) => (
              <div key={c.label} className="card" onClick={c.onClick}
                style={{ padding: '0.75rem 1rem', flex: '1 1 130px', cursor: c.onClick ? 'pointer' : 'default', userSelect: 'none' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{c.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color }}>{typeof c.value === 'number' ? c.value.toLocaleString('id-ID') : c.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs + export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => { setTab(t.key); }}
                  style={{
                    padding: '0.45rem 0.95rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                    border: `1px solid ${tab === t.key ? 'var(--accent-gold)' : 'var(--border)'}`,
                    background: tab === t.key ? 'rgba(201,168,76,0.12)' : 'transparent',
                    color: tab === t.key ? '#8B6914' : 'var(--text-secondary)', cursor: 'pointer',
                  }}>
                  {t.label}{t.count != null ? ` (${t.count})` : ''}
                </button>
              ))}
            </div>
            <button onClick={handleExport} disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.875rem', background: 'var(--bg-dark)', border: 'none', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-gold)', cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
              {exporting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />} Download XLSX
            </button>
          </div>

          {/* Filter bar */}
          <div className="card" style={{ padding: '0.75rem 0.875rem', marginBottom: '0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <input placeholder="Cari nama…" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} style={{ ...INPUT_STYLE, width: '160px' }} />

            {tab === 'cocok' && (
              <>
                <select value={filters.confidence} onChange={(e) => setFilter('confidence', e.target.value)} style={SELECT_STYLE}>
                  <option value="">Semua confidence</option>
                  <option value="EXACT">Exact</option>
                  <option value="FUZZY">Fuzzy</option>
                </select>
                <select value={filters.priceMatch} onChange={(e) => setFilter('priceMatch', e.target.value)} style={SELECT_STYLE}>
                  <option value="">Harga: semua</option>
                  <option value="true">Harga cocok</option>
                  <option value="false">Harga selisih</option>
                </select>
              </>
            )}

            {(tab === 'cocok' || tab === 'cloud') && (
              <select value={filters.codeType} onChange={(e) => setFilter('codeType', e.target.value)} style={SELECT_STYLE}>
                <option value="">Semua tipe kode</option>
                <option value="SAP_7">SAP (7)</option>
                <option value="XEVLA_6">XEVLA (6)</option>
                <option value="OTHER">Lainnya</option>
              </select>
            )}

            {(tab === 'cocok' || tab === 'fisik') && (
              <select value={filters.subGroup} onChange={(e) => setFilter('subGroup', e.target.value)} style={SELECT_STYLE}>
                <option value="">Semua sub group</option>
                {subGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {tab === 'cocok' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Selisih</span>
                <input placeholder="min" inputMode="numeric" value={filters.priceDiffMin} onChange={(e) => setFilter('priceDiffMin', e.target.value.replace(/[^\d]/g, ''))} style={{ ...INPUT_STYLE, width: '80px' }} />
                <span style={{ color: 'var(--text-secondary)' }}>–</span>
                <input placeholder="max" inputMode="numeric" value={filters.priceDiffMax} onChange={(e) => setFilter('priceDiffMax', e.target.value.replace(/[^\d]/g, ''))} style={{ ...INPUT_STYLE, width: '80px' }} />
              </span>
            )}

            {hasActiveFilters && (
              <button onClick={() => setFilters(EMPTY_FILTERS)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '34px', padding: '0 0.6rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.74rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={12} /> Reset
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {loadingRows ? 'memuat…' : `${tab === 'fisik' ? notInFisik.length : rows.length} baris`}
            </span>
          </div>

          {/* Tables */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              {tab === 'cocok' && (
                <table>
                  <thead>
                    <tr>
                      <th>Fisik Code</th><th>Tipe</th><th>Fisik Name</th><th>Master Code</th><th>Master Name</th>
                      <th style={{ textAlign: 'right' }}>Fisik</th><th style={{ textAlign: 'right' }}>Master</th><th style={{ textAlign: 'right' }}>Selisih</th>
                      <th>Harga</th><th>Confidence</th><th>Metode</th><th>Sub Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const discrepancy = r.priceMatch === false;
                      return (
                        <tr key={r.id} style={{ background: discrepancy ? AMBER_BG : undefined }}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-primary)' }}>{r.fisikCode}</td>
                          <td style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{r.codeType}</td>
                          <td style={{ maxWidth: '160px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fisikName}</div></td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600, color: '#C9A84C' }}>{r.matchedMasterCode}</td>
                          <td style={{ maxWidth: '160px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.matchedMasterName}</div></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: discrepancy ? 700 : 400, color: discrepancy ? '#8B6914' : undefined }}>{r.fisikPrice != null ? formatPrice(r.fisikPrice) : '—'}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: discrepancy ? 700 : 400, color: discrepancy ? '#8B6914' : undefined }}>{r.matchedMasterPrice != null ? formatPrice(r.matchedMasterPrice) : '—'}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: discrepancy ? '#8B6914' : 'var(--text-secondary)' }}>{r.priceDiff != null && r.priceDiff !== 0 ? formatPrice(r.priceDiff) : '—'}</td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px',
                              background: r.priceMatch ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                              color: r.priceMatch ? '#2D4A2E' : '#7A2E1F',
                              border: `1px solid ${r.priceMatch ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`
                            }}>
                              {r.priceMatch ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            {r.matchConfidence === 'FUZZY' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)' }}>
                                <AlertCircle size={11} /> Fuzzy
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', background: 'rgba(61,90,62,0.1)', color: '#2D4A2E', border: '1px solid rgba(61,90,62,0.2)' }}>Exact</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{METHOD_LABEL[r.matchMethod] ?? r.matchMethod}</td>
                          <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '120px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subGroup ?? '—'}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {tab === 'cloud' && (
                <table>
                  <thead>
                    <tr><th>Fisik Code</th><th>Tipe</th><th>Fisik Name</th><th style={{ textAlign: 'right' }}>Fisik Price</th><th style={{ textAlign: 'right' }}>Qty</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-primary)' }}>{r.fisikCode}</td>
                        <td style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{r.codeType}</td>
                        <td>{r.fisikName}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.fisikPrice != null ? formatPrice(r.fisikPrice) : '—'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.fisikQty ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'fisik' && (
                <table>
                  <thead>
                    <tr><th>Master Code</th><th>Master Name</th><th style={{ textAlign: 'right' }}>Master Price</th><th>Outlets</th><th>Sub Group</th></tr>
                  </thead>
                  <tbody>
                    {notInFisik.map((m) => (
                      <tr key={m.code}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600, color: '#C9A84C' }}>{m.code}</td>
                        <td style={{ maxWidth: '240px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{m.price != null ? formatPrice(m.price) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '220px' }}>
                            {(m.outlets ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 6).map((o) => (
                              <span key={o} style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{m.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loadingRows && ((tab === 'fisik' ? notInFisik.length : rows.length) === 0) && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tidak ada baris untuk filter ini.</div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
