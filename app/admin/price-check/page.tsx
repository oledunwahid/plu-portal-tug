'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, BadgeDollarSign, ScanBarcode, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { WineWarnings } from '@/components/WineWarnings';
import type { RowMatch, BarcodeMismatch, PriceLevelsWarning } from '@/lib/itemMatch';

// Read-only admin verification view: upload a price-change export, resolve every
// row against the Quinos master, and show the current name/price next to the
// requested price. Wine rows additionally carry the dual-lookup (barcode
// integrity) + price-levels advisories. Reuses /api/plu/match-batch - no request
// is created here.
//
// Identity rules (all departments, not just wine):
//   - Code column is the primary identity for EVERY row. It resolves exactly via
//     the matcher's Phase-1 code lookup, no fuzzy scan involved.
//   - Barcode is only meaningful for WINE (CNS), where Quinos stores the SAP Item
//     No. as the "barcode". For any other department the barcode column is not a
//     reliable key, so we don't feed it to the matcher - Code (then name+category)
//     decides instead.

interface CheckRow {
  rowNum: number;
  code: string;
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

// Header aliases per logical field, lowercased. Departments export with slightly
// different headings ("PLU", "Item Name", "New Price", …) - accept them all
// rather than silently reading an empty column.
const HEADER_ALIASES: Record<string, string[]> = {
  code: ['code', 'plu', 'plu code', 'plucode', 'item code', 'itemcode', 'kode'],
  name: ['name', 'item name', 'itemname', 'description', 'nama', 'nama item'],
  category: ['category', 'categories', 'kategori', 'sub category', 'subcategory'],
  department: ['department', 'dept', 'departemen', 'divisi'],
  barcode: ['barcode', 'bar code', 'ean', 'item no', 'item no.', 'itemno'],
  price: ['price', 'new price', 'newprice', 'harga', 'harga baru', 'price new'],
};

// Map each logical field to the actual header present in the file (first alias
// that matches, case/whitespace-insensitive). Missing field → undefined.
function resolveHeaders(headers: string[]): Record<string, string | undefined> {
  const norm = (h: string) => h.toLowerCase().replace(/\s+/g, ' ').trim();
  const byNorm = new Map<string, string>();
  for (const h of headers) if (h) byNorm.set(norm(h), h);
  const out: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    out[field] = aliases.map((a) => byNorm.get(a)).find(Boolean);
  }
  return out;
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
        if (raw.length < 2) { resolve({ headers: [], rows: [] }); return; }
        const headers = (raw[0] as string[]).map((h) => String(h ?? '').trim());
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < raw.length; i++) {
          const cells = raw[i] as unknown[];
          const row: Record<string, string> = {};
          headers.forEach((h, j) => { row[h] = cells[j] != null ? String(cells[j]).trim() : ''; });
          if (headers.some((h) => row[h] !== '')) rows.push(row);
        }
        resolve({ headers, rows });
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
      const { headers, rows: parsed } = await parseFile(file);
      if (parsed.length === 0) { toast.error('File kosong atau tidak punya baris data'); return; }

      const col = resolveHeaders(headers);
      // A file needs at least one usable identity column, otherwise every row
      // would come back unmatched and the reason would be invisible.
      if (!col.code && !col.name) {
        toast.error('File harus punya kolom Code atau Name. Kolom terbaca: ' + headers.filter(Boolean).join(', '));
        return;
      }
      const get = (r: Record<string, string>, field: string) => (col[field] ? (r[col[field]!] ?? '') : '');

      const inputs = parsed.map((r) => {
        const department = get(r, 'department');
        return {
          code: get(r, 'code'),
          name: get(r, 'name'),
          category: get(r, 'category'),
          department,
          // Barcode is only a valid key for wine (Quinos stores the SAP Item No.
          // there). Feeding a non-wine barcode to the matcher produces bogus
          // hits, so non-wine rows resolve by Code / name+category instead.
          barcode: isWine(department) ? get(r, 'barcode') : '',
        };
      });

      const res = await fetch('/api/plu/match-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: inputs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Matcher gagal (HTTP ${res.status})`);
      }
      const data = await res.json();
      const results: RowMatch[] = data.results ?? [];
      const checkRows: CheckRow[] = parsed.map((r, i) => ({
        rowNum: i + 1,
        code: get(r, 'code'),
        name: get(r, 'name'),
        category: get(r, 'category'),
        department: get(r, 'department'),
        barcode: get(r, 'barcode'),
        price: sanitizePrice(get(r, 'price')),
        match: results[i] ?? { type: 'none' },
      }));
      setRows(checkRows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses file. Coba lagi.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const unmatched = rows.filter((r) => !r.match.master && !(r.match.candidates && r.match.candidates.length));
  // A row is "flagged" if it needs the admin's eyes: unresolved identity (any
  // department), or a wine advisory. Unmatched used to be invisible under the
  // filter even though it's the most actionable problem.
  const flagged = rows.filter((r) => {
    const w = rowWarnings(r);
    const noMatch = !r.match.master && !(r.match.candidates && r.match.candidates.length);
    return noMatch || w.barcodeMismatch || w.priceLevels;
  });
  const barcodeFlags = rows.filter((r) => rowWarnings(r).barcodeMismatch).length;
  const priceLevelFlags = rows.filter((r) => rowWarnings(r).priceLevels).length;
  const visible = onlyFlagged ? flagged : rows;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Price Change Verification</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Upload a price-change file from any department to see each item&apos;s current name and price against the requested one. Wine (CNS) rows additionally get barcode-integrity and price-level checks. Detection only - nothing is submitted or corrected here.
        </p>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Upload Price Change File</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Kolom: <strong>Code</strong> (identitas utama), Name, Category, Department, Price. Barcode hanya dipakai untuk department WINE. Judul kolom umum lain (PLU, Item Name, New Price, …) ikut dikenali.
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
              { label: 'Tidak ditemukan', value: unmatched.length, color: unmatched.length ? '#7A2E1F' : 'var(--text-primary)', icon: <AlertTriangle size={15} /> },
              { label: 'Barcode mismatch (wine)', value: barcodeFlags, color: '#7A2E1F', icon: <ScanBarcode size={15} /> },
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
              const m = r.match;
              const resolved = m.master ?? m.candidates?.[0];
              const noMatch = !resolved;
              const flaggedRow = !!(noMatch || w.barcodeMismatch || w.priceLevels);
              const newPrice = r.price ? Number(r.price) : null;
              const oldPrice = resolved?.price ?? null;
              return (
                <div key={r.rowNum} style={{
                  border: `1px solid ${noMatch ? 'rgba(122,46,31,0.3)' : flaggedRow ? 'rgba(184,134,11,0.25)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${noMatch ? '#7A2E1F' : flaggedRow ? '#B8860B' : '#3D5A3E'}`,
                  borderRadius: '0.375rem', padding: '0.75rem 0.875rem', marginBottom: '0.625rem',
                  background: flaggedRow ? 'rgba(184,134,11,0.025)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>#{r.rowNum}</span>
                    {isWine(r.department) ? (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: 'rgba(122,46,31,0.08)', color: '#7A2E1F', border: '1px solid rgba(122,46,31,0.2)' }}>WINE</span>
                    ) : r.department ? (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: 'var(--bg-dark)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{r.department.toUpperCase()}</span>
                    ) : null}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.name || r.code || <em style={{ color: 'var(--text-secondary)' }}>tanpa nama</em>}
                    </span>
                    {r.category && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>· {r.category}</span>}
                    {resolved && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        → <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A84C' }}>{('code' in resolved && resolved.code) || '?'}</span>
                        {' '}<span style={{ color: 'var(--text-primary)' }}>{resolved.name}</span>
                        {m.type && m.type !== 'none' && <span style={{ marginLeft: '0.35rem', opacity: 0.75 }}>({m.type})</span>}
                      </span>
                    )}
                    <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>Lama <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{oldPrice != null ? `Rp ${fmtRp(oldPrice)}` : '—'}</span></span>
                      <span style={{ opacity: 0.5 }}>→</span>
                      <span>Baru <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{newPrice != null ? `Rp ${fmtRp(newPrice)}` : '—'}</span></span>
                    </div>
                  </div>
                  {noMatch && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#7A2E1F' }}>
                      Tidak ditemukan di master Quinos
                      {r.code ? <> - kode <span style={{ fontFamily: 'monospace' }}>{r.code}</span> tidak terdaftar.</> : ' - isi kolom Code agar bisa dicocokkan secara pasti.'}
                    </div>
                  )}
                  {!noMatch && oldPrice != null && newPrice != null && oldPrice === newPrice && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Harga baru sama dengan harga saat ini - tidak ada perubahan.</div>
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
