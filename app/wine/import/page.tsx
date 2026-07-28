'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft, Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, Undo2,
} from 'lucide-react';
import {
  WINE_IMPORT_FIELDS, WINE_IMPORT_FIELD_LABELS, WINE_IMPORT_REQUIRED_FIELDS,
  type WineImportField, type WineColumnMapping,
} from '@/lib/wineImport';
import { WINE_FIELD_STYLE, WINE_SELECT_STYLE, formatDateTime } from '@/components/wine/wineUi';

interface PreviewRow {
  rowNumber: number;
  wineName: string;
  producer: string | null;
  vintage: number | null;
  isNonVintage: boolean;
  bottleSize: string | null;
  outcome: string;
  matchMethod: string;
  masterItemCode: string | null;
  note: string | null;
  warnings: string[];
}

interface Summary {
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  duplicateRows: number;
  failedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
}

interface PreviewResponse {
  fileName: string;
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  mapping: WineColumnMapping;
  needsMapping: boolean;
  totalRows: number;
  summary?: Summary;
  preview?: PreviewRow[];
  previewTruncated?: boolean;
  errors?: { rowNumber: number; wineName: string | null; pluCode: string | null; barcode: string | null; error: string; recommendation: string }[];
  error?: string;
}

interface Batch {
  id: string;
  fileName: string;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  duplicateRows: number;
  failedRows: number;
  skippedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  status: string;
  uploadedAt: string;
  rolledBackAt: string | null;
}

const OUTCOME_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  CREATE: { label: 'Create', color: '#2D4A2E', bg: 'rgba(61,90,62,0.1)' },
  UPDATE: { label: 'Update', color: '#8B6914', bg: 'rgba(184,134,11,0.1)' },
  UNMATCHED: { label: 'Unmatched', color: '#8B3A2A', bg: 'rgba(139,58,42,0.08)' },
  DUPLICATE_IN_FILE: { label: 'Duplicate', color: '#8B3A2A', bg: 'rgba(139,58,42,0.08)' },
  DUPLICATE_EXISTING: { label: 'Duplicate', color: '#8B3A2A', bg: 'rgba(139,58,42,0.08)' },
  FAILED: { label: 'Failed', color: '#8B3A2A', bg: 'rgba(139,58,42,0.08)' },
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const style = OUTCOME_STYLES[outcome] ?? { label: outcome, color: 'var(--text-secondary)', bg: 'var(--bg-cream)' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '0.25rem',
      fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: style.color, background: style.bg, whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? '#2D4A2E' : tone === 'warn' ? '#8B6914' : tone === 'bad' ? '#8B3A2A' : 'var(--text-primary)';
  return (
    <div className="card" style={{ padding: '0.7rem 0.9rem' }}>
      <div className="label-caps" style={{ fontSize: '0.56rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('id-ID')}
      </div>
    </div>
  );
}

/**
 * Legacy Wine List import: upload → sheet → column mapping → preview & validation → execute →
 * summary + error report + rollback.
 *
 * The file stays in the browser between preview and execute and is posted again on confirm - the
 * server re-parses and re-plans it, so what gets written is decided against the registry as it is at
 * execution time, not as it was during preview.
 */
export default function WineImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<WineColumnMapping>({});
  const [sheet, setSheet] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ batchId: string; summary: Summary; errorCount: number } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/wines/import/batches');
      if (!res.ok) return;
      const data = await res.json();
      setBatches(data.batches ?? []);
    } catch {
      /* the history panel is supplementary - a failure here must not block importing */
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const runPreview = useCallback(async (
    targetFile: File,
    nextMapping?: WineColumnMapping,
    nextSheet?: string,
  ) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', targetFile);
      if (nextSheet) form.append('sheet', nextSheet);
      if (nextMapping) form.append('mapping', JSON.stringify(nextMapping));
      const res = await fetch('/api/wines/import/preview', { method: 'POST', body: form });
      const data = (await res.json()) as PreviewResponse;
      if (!res.ok) throw new Error(data?.error ?? 'Gagal membaca file.');
      setPreview(data);
      setMapping(data.mapping ?? {});
      setSheet(data.sheetName);
      if (data.error) toast.warning(data.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membaca file.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setResult(null);
    if (selected) runPreview(selected);
  }

  function updateMapping(field: WineImportField, column: string) {
    const next = { ...mapping };
    if (column) next[field] = column;
    else delete next[field];
    setMapping(next);
    if (file) runPreview(file, next, sheet);
  }

  async function handleExecute() {
    if (!file || !preview || preview.needsMapping) return;
    setExecuting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('sheet', sheet);
      form.append('mapping', JSON.stringify(mapping));
      const res = await fetch('/api/wines/import/execute', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Import gagal.');
      setResult({ batchId: data.batchId, summary: data.summary, errorCount: data.errorCount ?? 0 });
      toast.success(`Import selesai: ${data.summary.createdRows} dibuat, ${data.summary.updatedRows} diperbarui.`);
      await loadBatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import gagal.');
    } finally {
      setExecuting(false);
    }
  }

  async function handleRollback(batchId: string) {
    setRollingBack(batchId);
    try {
      const res = await fetch(`/api/wines/import/${batchId}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Rollback gagal.');
      toast.success(
        data.keptModified > 0
          ? `${data.removed} wine dihapus. ${data.keptModified} wine dipertahankan karena sudah diubah manual.`
          : `${data.removed} wine dihapus.`,
      );
      await loadBatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rollback gagal.');
    } finally {
      setRollingBack(null);
    }
  }

  const summary = preview?.summary;

  return (
    <div>
      <Link
        href="/wine/list"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ChevronLeft size={13} /> Wine List
      </Link>
      <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Import Wine List</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '760px' }}>
        Import data wine lama (CSV atau Excel). Kolom <strong>Code</strong> pada file lama diperlakukan
        sebagai Legacy Wine Code - bukan PLU Code. Import tidak pernah membuat Master Item baru: baris
        yang tidak cocok akan dilaporkan sebagai <em>Unmatched</em> untuk dipetakan manual.
      </p>

      {/* Step 1 - upload */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>1 · Upload File</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <Upload size={13} /> Pilih File
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {file && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              <FileSpreadsheet size={13} style={{ color: '#8B6914' }} />
              {file.name}
            </span>
          )}
          {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />}
        </div>

        {preview && preview.sheetNames.length > 1 && (
          <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="label-caps">Sheet</span>
            <select
              value={sheet}
              onChange={(e) => {
                setSheet(e.target.value);
                // A different sheet means different headers - re-suggest the mapping from scratch.
                if (file) runPreview(file, undefined, e.target.value);
              }}
              style={WINE_SELECT_STYLE}
            >
              {preview.sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Step 2 - column mapping */}
      {preview && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.3rem', fontSize: '0.95rem' }}>2 · Column Mapping</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.9rem' }}>
            Pemetaan awal ditebak dari header file. Periksa dan sesuaikan bila perlu.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.7rem' }}>
            {WINE_IMPORT_FIELDS.map((field) => {
              const required = WINE_IMPORT_REQUIRED_FIELDS.includes(field);
              const missing = required && !mapping[field];
              return (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label className="label-caps">
                    {WINE_IMPORT_FIELD_LABELS[field]}
                    {required && <span style={{ color: '#8B3A2A', marginLeft: '0.2rem' }}>*</span>}
                  </label>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) => updateMapping(field, e.target.value)}
                    style={{
                      ...WINE_FIELD_STYLE, cursor: 'pointer',
                      borderColor: missing ? '#8B3A2A' : 'var(--input-border)',
                    }}
                  >
                    <option value="">- tidak dipetakan —</option>
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 - preview + validation */}
      {preview && !preview.needsMapping && summary && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
            3 · Preview &amp; Validation
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <SummaryTile label="Total Rows" value={summary.totalRows} />
            <SummaryTile label="Created" value={summary.createdRows} tone="good" />
            <SummaryTile label="Updated" value={summary.updatedRows} tone="warn" />
            <SummaryTile label="Matched" value={summary.matchedRows} tone="good" />
            <SummaryTile label="Unmatched" value={summary.unmatchedRows} tone="bad" />
            <SummaryTile label="Duplicate" value={summary.duplicateRows} tone="bad" />
            <SummaryTile label="Skipped" value={summary.skippedRows} />
            <SummaryTile label="Failed" value={summary.failedRows} tone="bad" />
          </div>

          {preview.preview && preview.preview.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', marginBottom: '0.75rem' }}>
              <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Outcome</th>
                      <th style={{ minWidth: '190px' }}>Wine Name</th>
                      <th>Producer</th>
                      <th>Vintage</th>
                      <th>Bottle Size</th>
                      <th>Match</th>
                      <th>PLU Code</th>
                      <th style={{ minWidth: '200px' }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row) => (
                      <tr key={row.rowNumber}>
                        <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{row.rowNumber}</td>
                        <td><OutcomeBadge outcome={row.outcome} /></td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 500 }}>{row.wineName || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.producer ?? '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{row.isNonVintage ? 'NV' : row.vintage ?? '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.bottleSize ?? '—'}</td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{row.matchMethod}</td>
                        <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#8B6914' }}>{row.masterItemCode ?? '—'}</td>
                        <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {row.note ?? row.warnings?.join(' ') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {preview.previewTruncated && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
              Menampilkan {preview.preview?.length} dari {preview.totalRows} baris. Seluruh baris akan
              diproses saat import dijalankan.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExecute}
              disabled={executing || summary.matchedRows === 0}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {executing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
              Confirm &amp; Import {summary.matchedRows.toLocaleString('id-ID')} baris
            </button>
            {summary.matchedRows === 0 && (
              <span style={{ fontSize: '0.75rem', color: '#8B3A2A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={12} /> Tidak ada baris yang dapat diimport.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step 4 - result */}
      {result && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>4 · Import Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <SummaryTile label="Created" value={result.summary.createdRows} tone="good" />
            <SummaryTile label="Updated" value={result.summary.updatedRows} tone="warn" />
            <SummaryTile label="Matched" value={result.summary.matchedRows} tone="good" />
            <SummaryTile label="Unmatched" value={result.summary.unmatchedRows} tone="bad" />
            <SummaryTile label="Duplicate" value={result.summary.duplicateRows} tone="bad" />
            <SummaryTile label="Skipped" value={result.summary.skippedRows} />
            <SummaryTile label="Failed" value={result.summary.failedRows} tone="bad" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {result.errorCount > 0 && (
              <a
                href={`/api/wines/import/${result.batchId}/errors?format=csv`}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
              >
                <Download size={13} /> Download error report ({result.errorCount})
              </a>
            )}
            <Link href="/wine/list" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Lihat Wine List
            </Link>
          </div>
        </div>
      )}

      {/* Batch history + rollback */}
      {batches.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 className="section-title" style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Riwayat Import</h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>File</th>
                  <th>Uploaded</th>
                  <th style={{ textAlign: 'right' }}>Created</th>
                  <th style={{ textAlign: 'right' }}>Updated</th>
                  <th style={{ textAlign: 'right' }}>Skipped</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {batch.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{batch.fileName}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(batch.uploadedAt)}
                    </td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right' }}>{batch.createdRows}</td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right' }}>{batch.updatedRows}</td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right' }}>{batch.skippedRows}</td>
                    <td style={{ fontSize: '0.72rem', color: batch.rolledBackAt ? '#8B3A2A' : 'var(--text-secondary)' }}>
                      {batch.status}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <a
                        href={`/api/wines/import/${batch.id}/errors?format=csv`}
                        style={{ fontSize: '0.72rem', color: '#8B6914', textDecoration: 'none', marginRight: '0.6rem' }}
                      >
                        Errors
                      </a>
                      {!batch.rolledBackAt && batch.createdRows > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRollback(batch.id)}
                          disabled={rollingBack === batch.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B3A2A', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          {rollingBack === batch.id
                            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Undo2 size={11} />}
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', marginBottom: 0 }}>
            Rollback hanya menghapus wine yang dibuat oleh batch tersebut dan belum diubah manual
            setelahnya.
          </p>
        </div>
      )}

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
