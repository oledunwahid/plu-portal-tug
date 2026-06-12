'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, ArrowLeftRight, Loader2, Download, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface MasterItem {
  id: string; code: string; name: string; price: number | null;
  barcode: string | null; outlets: string | null; department: string;
}

interface FisikRow {
  code: string; name: string; price: number | null; qty: number | null;
}

interface FoundRow {
  fisikCode: string; fisikName: string; masterCode: string; masterName: string;
  fisikPrice: number | null; masterPrice: number | null;
  priceMatch: boolean; confidence: 'exact' | 'fuzzy';
}

const DEPARTMENTS = ['WINE', 'ALCOHOLIC BEVERAGES', 'NON ALCOHOLIC BEVERAGES', 'ALL'];

const AMBER_BG = 'rgba(251,191,36,0.1)';

const SELECT_STYLE: React.CSSProperties = {
  height: '36px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.625rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// A real item code is alphanumeric and contains at least one digit. This skips
// category header rows like "Australia", "Hampers", and dashed labels like "1-1".
function isItemCode(code: string): boolean {
  return /^[A-Za-z0-9]+$/.test(code) && /\d/.test(code);
}

function nameContains(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

type TabKey = 'cocok' | 'cloud' | 'fisik';

export default function ReconcilePage() {
  const [department, setDepartment] = useState('WINE');
  const [masters, setMasters] = useState<MasterItem[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [fisikRows, setFisikRows] = useState<FisikRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<TabKey>('cocok');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMasters = useCallback(async (dept: string) => {
    setLoadingMasters(true);
    try {
      const params = new URLSearchParams({ activeOnly: 'true', limit: '9999' });
      if (dept !== 'ALL') params.set('department', dept);
      const res = await fetch(`/api/admin/kb/items?${params}`);
      if (!res.ok) throw new Error('Gagal memuat master registry');
      const data = await res.json();
      setMasters((data.items ?? []) as MasterItem[]);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal memuat data master');
      setMasters([]);
    } finally {
      setLoadingMasters(false);
    }
  }, []);

  useEffect(() => { fetchMasters(department); }, [department, fetchMasters]);

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
      toast.error('Hanya file .xlsx atau .csv yang didukung.');
      return;
    }
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });

      const pick = (row: Record<string, unknown>, keys: string[]): string => {
        for (const k of Object.keys(row)) {
          const norm = k.toLowerCase().replace(/[\s_]/g, '');
          if (keys.includes(norm)) return String(row[k] ?? '').trim();
        }
        return '';
      };

      const cleaned: FisikRow[] = [];
      for (const row of raw) {
        const code = pick(row, ['itemcode', 'code', 'kodeitem', 'kode']);
        const name = pick(row, ['itemname', 'name', 'namaitem', 'nama']);
        const price = num(pick(row, ['price', 'harga', 'sellprice']));
        const qty = num(pick(row, ['qty', 'quantity', 'qtyonhand', 'stock', 'stok']));
        if (!isItemCode(code)) continue;
        if (!name || name === '-') continue;
        if (!((qty != null && qty > 0) || (price != null && price > 0))) continue;
        cleaned.push({ code, name, price, qty });
      }

      if (cleaned.length === 0) {
        toast.error('Tidak ada baris valid ditemukan pada file.');
      } else {
        toast.success(`${cleaned.length} baris fisik toko dimuat.`);
      }
      setFisikRows(cleaned);
      setFileName(file.name);
      setTab('cocok');
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal membaca file');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Reconciliation (runs in the browser against the fetched masters) ──────────
  const barcodeMap = new Map<string, MasterItem>();
  for (const m of masters) {
    const bc = (m.barcode ?? '').trim();
    if (bc) barcodeMap.set(bc, m);
  }

  const found: FoundRow[] = [];
  const notInCloud: FisikRow[] = [];
  const usedMasterIds = new Set<string>();

  for (const f of fisikRows) {
    let match: MasterItem | undefined = barcodeMap.get(f.code);
    let confidence: 'exact' | 'fuzzy' = 'exact';
    if (!match) {
      match = masters.find((m) => nameContains(m.name, f.name));
      confidence = 'fuzzy';
    }
    if (match) {
      usedMasterIds.add(match.id);
      found.push({
        fisikCode: f.code, fisikName: f.name,
        masterCode: match.code, masterName: match.name,
        fisikPrice: f.price, masterPrice: match.price,
        priceMatch: f.price != null && match.price != null && f.price === match.price,
        confidence,
      });
    } else {
      notInCloud.push(f);
    }
  }
  const notInFisik = masters.filter((m) => !usedMasterIds.has(m.id));
  const priceDiscrepancies = found.filter((r) => !r.priceMatch && r.fisikPrice != null && r.masterPrice != null).length;

  const hasResult = fisikRows.length > 0;

  function exportCurrentTab() {
    const date = new Date().toISOString().slice(0, 10);
    if (tab === 'cocok') {
      const csv = toCsv(
        ['Fisik Code', 'Fisik Name', 'Master Code', 'Master Name', 'Fisik Price', 'Master Price', 'Price Match', 'Confidence'],
        found.map((r) => [r.fisikCode, r.fisikName, r.masterCode, r.masterName, r.fisikPrice ?? '', r.masterPrice ?? '', r.priceMatch ? 'Yes' : 'No', r.confidence]),
      );
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `rekonsiliasi-cocok-${date}.csv`);
    } else if (tab === 'cloud') {
      const csv = toCsv(
        ['Fisik Code', 'Fisik Name', 'Fisik Price'],
        notInCloud.map((r) => [r.code, r.name, r.price ?? '']),
      );
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `rekonsiliasi-tidak-di-cloud-${date}.csv`);
    } else {
      const csv = toCsv(
        ['Master Code', 'Master Name', 'Master Price', 'Outlets'],
        notInFisik.map((r) => [r.code, r.name, r.price ?? '', (r.outlets ?? '').split(/[;,]/).filter(Boolean).join(' ')]),
      );
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `rekonsiliasi-tidak-di-fisik-${date}.csv`);
    }
    toast.success('CSV diunduh');
  }

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'cocok', label: 'Cocok', count: found.length },
    { key: 'cloud', label: 'Tidak di Cloud', count: notInCloud.length },
    { key: 'fisik', label: 'Tidak di Fisik', count: notInFisik.length },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ArrowLeftRight size={22} style={{ color: '#C9A84C' }} />
          <h1 className="page-title">Rekonsiliasi Stok</h1>
        </div>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Bandingkan data fisik toko dengan Master Item Registry.
        </p>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Upload File Fisik Toko</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', maxWidth: '520px' }}>
              Format yang didukung: file ekspor stok fisik dengan kolom Item Code, Item Name, dan Price.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="label-caps" style={{ fontSize: '0.62rem' }}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={SELECT_STYLE}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {loadingMasters
              ? <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> memuat…</span>
              : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{masters.length.toLocaleString('id-ID')} item master</span>}
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#C9A84C' : 'var(--border)'}`,
            borderRadius: '8px', padding: '1.5rem', textAlign: 'center',
            cursor: 'pointer', background: dragOver ? 'rgba(201,168,76,0.04)' : 'transparent',
            transition: 'all 150ms',
          }}
        >
          {parsing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Memproses…</span>
            </div>
          ) : (
            <>
              <Upload size={20} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {fileName ? `${fileName} — klik untuk ganti` : 'Klik untuk unggah atau seret file ke sini'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                .xlsx atau .csv
              </div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {hasResult && (
        <>
          {/* Summary bar */}
          <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span><strong style={{ color: 'var(--text-primary)' }}>{fisikRows.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>item fisik</span></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span><strong style={{ color: '#2D4A2E' }}>{found.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>cocok</span></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span><strong style={{ color: '#7A2E1F' }}>{notInCloud.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>tidak di cloud</span></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span><strong style={{ color: '#7A2E1F' }}>{notInFisik.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>tidak di fisik</span></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span><strong style={{ color: '#8B6914' }}>{priceDiscrepancies}</strong> <span style={{ color: 'var(--text-secondary)' }}>selisih harga</span></span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding: '0.45rem 0.95rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                    border: `1px solid ${tab === t.key ? 'var(--accent-gold)' : 'var(--border)'}`,
                    background: tab === t.key ? 'rgba(201,168,76,0.12)' : 'transparent',
                    color: tab === t.key ? '#8B6914' : 'var(--text-secondary)', cursor: 'pointer',
                  }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <button onClick={exportCurrentTab}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.875rem', background: 'var(--bg-dark)', border: 'none', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-gold)', cursor: 'pointer' }}>
              <Download size={13} /> Download CSV
            </button>
          </div>

          {/* Tables */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              {tab === 'cocok' && (
                <table>
                  <thead>
                    <tr>
                      <th>Fisik Code</th><th>Fisik Name</th><th>Master Code</th><th>Master Name</th>
                      <th style={{ textAlign: 'right' }}>Fisik Price</th><th style={{ textAlign: 'right' }}>Master Price</th>
                      <th>Price Match</th><th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.map((r, i) => {
                      const discrepancy = !r.priceMatch && r.fisikPrice != null && r.masterPrice != null;
                      return (
                        <tr key={i} style={{ background: discrepancy ? AMBER_BG : undefined }}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-primary)' }}>{r.fisikCode}</td>
                          <td style={{ maxWidth: '170px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fisikName}</div></td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600, color: '#C9A84C' }}>{r.masterCode}</td>
                          <td style={{ maxWidth: '170px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.masterName}</div></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: discrepancy ? 700 : 400, color: discrepancy ? '#8B6914' : undefined }}>{r.fisikPrice != null ? formatPrice(r.fisikPrice) : '—'}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: discrepancy ? 700 : 400, color: discrepancy ? '#8B6914' : undefined }}>{r.masterPrice != null ? formatPrice(r.masterPrice) : '—'}</td>
                          <td>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px',
                              background: r.priceMatch ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                              color: r.priceMatch ? '#2D4A2E' : '#7A2E1F',
                              border: `1px solid ${r.priceMatch ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}` }}>
                              {r.priceMatch ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            {r.confidence === 'fuzzy' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', background: AMBER_BG, color: '#8B6914', border: '1px solid rgba(201,168,76,0.3)' }}>
                                <AlertCircle size={11} /> Nama mirip
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px', background: 'rgba(61,90,62,0.1)', color: '#2D4A2E', border: '1px solid rgba(61,90,62,0.2)' }}>Exact</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {tab === 'cloud' && (
                <table>
                  <thead>
                    <tr><th>Fisik Code</th><th>Fisik Name</th><th style={{ textAlign: 'right' }}>Fisik Price</th></tr>
                  </thead>
                  <tbody>
                    {notInCloud.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-primary)' }}>{r.code}</td>
                        <td>{r.name}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.price != null ? formatPrice(r.price) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'fisik' && (
                <table>
                  <thead>
                    <tr><th>Master Code</th><th>Master Name</th><th style={{ textAlign: 'right' }}>Master Price</th><th>Outlets</th></tr>
                  </thead>
                  <tbody>
                    {notInFisik.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600, color: '#C9A84C' }}>{r.code}</td>
                        <td style={{ maxWidth: '240px' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.price != null ? formatPrice(r.price) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '220px' }}>
                            {(r.outlets ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 6).map((o) => (
                              <span key={o} style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
