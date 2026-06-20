'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, BadgeDollarSign, ScanBarcode, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { WineWarnings } from '@/components/WineWarnings';
import type { RowMatch, MatchCandidate, BarcodeMismatch, PriceLevelsWarning } from '@/lib/itemMatch';

// Read-only admin verification view: upload a price-change export and inspect the
// wine dual-lookup (barcode integrity) + price-levels warnings before the change
// is actioned. Reuses /api/plu/match-batch — no request is created here.

interface CheckRow {
  rowNum: number;
  name: string;
  category: string;
  department: string;
  barcode: string;
  price: string;
  match: RowMatch;
}

const fmtRp = (n: number) => n.toLocaleString('id-ID');

function sanitizePrice(raw: string): string {
  return String(raw ?? '').replace(/[^\d]/g, '');
}

// The identity used for warnings: resolved exact master, else the single top
// candidate (admin would pick it during a real import).
function rowWarnings(r: CheckRow): { barcodeMismatch?: BarcodeMismatch; priceLevels?: PriceLevelsWarning } {
  const m = r.match;
  if (m.barcodeMismatch || m.priceLevels) return { barcodeMismatch: m.barcodeMismatch, priceLevels: m.priceLevels };
  const top = m.candidates?.[0];
  if (top && (top.barcodeMismatch || top.priceLevels)) return { barcodeMismatch: top.barcodeMismatch, priceLevels: top.priceLevels };
  return {};
}

function isWine(dep: string): boolean {
  return dep.toLowerCase().includes('wine');
}

async function parseFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
        if (raw.length < 2) { resolve([]); return; }
        const headers = (raw[0] as string[]).map((h) => String(h ?? '').trim());
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < raw.length; i++) {
          const cells = raw[i] as unknown[];
          const row: Record<string, string> = {};
          headers.forEach((h, j) => { row[h] = cells[j] != null ? String(cells[j]).trim() : ''; });
          if (headers.some((h) => row[h] !== '')) rows.push(row);
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export default function PriceCheckPage() {
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      toast.error('Only .xlsx and .csv files are supported');
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { toast.error('File is empty or has no data rows'); return; }
      const inputs = parsed.map((r) => ({
        name: r['Name'] ?? '', category: r['Category'] ?? '',
        department: r['Department'] ?? '', barcode: r['Barcode'] ?? '',
      }));
      const res = await fetch('/api/plu/match-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: inputs }),
      });
      if (!res.ok) throw new Error('match failed');
      const data = await res.json();
      const results: RowMatch[] = data.results ?? [];
      const checkRows: CheckRow[] = parsed.map((r, i) => ({
        rowNum: i + 1,
        name: r['Name'] ?? '',
        category: r['Category'] ?? '',
        department: r['Department'] ?? '',
        barcode: r['Barcode'] ?? '',
        price: sanitizePrice(r['Price'] ?? ''),
        match: results[i] ?? { type: 'none' },
      }));
      setRows(checkRows);
    } catch {
      toast.error('Gagal memproses file. Coba lagi.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const wineRows = rows.filter((r) => isWine(r.department));
  const flagged = rows.filter((r) => { const w = rowWarnings(r); return w.barcodeMismatch || w.priceLevels; });
  const barcodeFlags = rows.filter((r) => rowWarnings(r).barcodeMismatch).length;
  const priceLevelFlags = rows.filter((r) => rowWarnings(r).priceLevels).length;
  const visible = onlyFlagged ? flagged : rows;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Price Change Verification</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Upload a price-change export to review wine barcode-integrity and active price-level warnings before actioning. Detection only — nothing is submitted or corrected here.
        </p>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Upload Price Change File</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Same format as the cashier UPDATE_PRICE import (Name, Category, Department, Barcode, Price).
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
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Mencocokkan dengan master & SAP…</span>
            </div>
          ) : (
            <>
              <Upload size={20} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>Click to upload or drag and drop</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>.xlsx or .csv format</div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {rows.length > 0 && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[
              { label: 'Total rows', value: rows.length, color: 'var(--text-primary)', icon: <BadgeDollarSign size={15} /> },
              { label: 'Wine rows', value: wineRows.length, color: 'var(--text-primary)', icon: <BadgeDollarSign size={15} /> },
              { label: 'Barcode mismatch', value: barcodeFlags, color: '#7A2E1F', icon: <ScanBarcode size={15} /> },
              { label: 'Price levels active', value: priceLevelFlags, color: '#8B6914', icon: <AlertTriangle size={15} /> },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: '0.75rem 1rem', flex: '1 1 140px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span style={{ color: s.color }}>{s.icon}</span>{s.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button type="button" onClick={() => setOnlyFlagged((v) => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '32px', padding: '0 0.75rem', background: onlyFlagged ? 'var(--bg-dark)' : 'transparent', color: onlyFlagged ? 'var(--accent-gold)' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
              <Filter size={13} /> {onlyFlagged ? 'Menampilkan baris berflag' : 'Tampilkan hanya yang berflag'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{visible.length} ditampilkan</span>
          </div>

          {/* Rows */}
          <div className="card" style={{ padding: '0.875rem' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={28} style={{ color: '#3D5A3E', margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.85rem' }}>Tidak ada peringatan untuk ditampilkan.</div>
              </div>
            ) : visible.map((r) => {
              const w = rowWarnings(r);
              const flaggedRow = !!(w.barcodeMismatch || w.priceLevels);
              const m = r.match;
              const resolved = m.master ?? m.candidates?.[0];
              return (
                <div key={r.rowNum} style={{
                  border: `1px solid ${flaggedRow ? 'rgba(184,134,11,0.25)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${flaggedRow ? '#B8860B' : '#3D5A3E'}`,
                  borderRadius: '0.375rem', padding: '0.75rem 0.875rem', marginBottom: '0.625rem',
                  background: flaggedRow ? 'rgba(184,134,11,0.025)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>#{r.rowNum}</span>
                    {isWine(r.department) && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: 'rgba(122,46,31,0.08)', color: '#7A2E1F', border: '1px solid rgba(122,46,31,0.2)' }}>WINE</span>}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name || <em style={{ color: 'var(--text-secondary)' }}>tanpa nama</em>}</span>
                    {r.category && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>· {r.category}</span>}
                    {resolved && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        → <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A84C' }}>{('code' in resolved && resolved.code) || '?'}</span>
                        {resolved.price != null && <> · harga lama Rp {fmtRp(resolved.price)}</>}
                      </span>
                    )}
                    <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Harga baru <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.price ? `Rp ${fmtRp(Number(r.price))}` : '—'}</span>
                    </div>
                  </div>
                  {m.type === 'none' && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#7A2E1F' }}>Tidak ditemukan di master Quinos.</div>
                  )}
                  <WineWarnings barcodeMismatch={w.barcodeMismatch} priceLevels={w.priceLevels} requestedPrice={r.price} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
