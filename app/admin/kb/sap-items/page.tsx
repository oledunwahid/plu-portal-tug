'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Upload, ChevronLeft, ChevronRight, Database, Download, Loader2 } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

interface SapItem {
  id: string; itemNo: string; description: string;
  subGroup: string | null; barcode: string | null;
  importedAt: string; updatedAt: string;
}

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.625rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

const EXPORT_HEADERS = ['Item No.', 'Item Description', 'Sub Group', 'Bar Code'] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SapItemsPage() {
  const [items, setItems] = useState<SapItem[]>([]);
  // COST_CONTROL has read-only access — the upload card is hidden.
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN';
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const [subGroups, setSubGroups] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [subGroup, setSubGroup] = useState('ALL');

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(total / 50);

  const fetchItems = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set('search', search);
      if (subGroup !== 'ALL') params.set('subGroup', subGroup);

      const res = await fetch(`/api/admin/kb/sap-items?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setLastImported(data.lastImported ?? null);
      if (data.subGroups?.length > 0) setSubGroups(data.subGroups);
    } catch {
      toast.error('Failed to load SAP items');
    } finally {
      setLoading(false);
    }
  }, [search, subGroup, page]);

  useEffect(() => { fetchItems(1); setPage(1); }, [search, subGroup]);
  useEffect(() => { fetchItems(page); }, [page]);

  async function handleUpload(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast.error('Please upload a .xlsx or .csv file.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/kb/sap-items/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      const { inserted, updated, skipped } = data;
      let msg = `SAP registry updated: ${inserted} imported, ${updated} updated`;
      if (skipped > 0) msg += `, ${skipped} skipped`;
      toast.success(msg);
      fetchItems(1);
      setPage(1);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ export: 'true' });
      if (search) params.set('search', search);
      if (subGroup !== 'ALL') params.set('subGroup', subGroup);
      const res = await fetch(`/api/admin/kb/sap-items?${params}`);
      if (!res.ok) throw new Error('Gagal mengambil data');
      const data = await res.json();
      const all = (data.items ?? []) as SapItem[];
      if (all.length === 0) { toast.error('Tidak ada item untuk diekspor'); return; }
      const escape = (v: string) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        EXPORT_HEADERS.join(','),
        ...all.map((r) => [r.itemNo, r.description, r.subGroup ?? '', r.barcode ?? ''].map(escape).join(',')),
      ].join('\n');
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `sap-items-${date}.csv`);
      toast.success(`CSV diunduh: ${all.length.toLocaleString()} item`);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal mengunduh');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Master Items SAP</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Independent registry from the SAP item export (List_of_Items-WINE.xlsx). Used to cross-check wine barcodes against the Quinos master.
        </p>
      </div>

      {/* Upload card — admin only (cost control is read-only). */}
      {isAdmin && (
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Upload SAP Item Export</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Columns: Item No., Item Description, Sub Group, Bar Code. Existing items (by Item No.) are updated.
            </div>
          </div>
          {lastImported && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
              Last updated<br />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {new Date(lastImported).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#C9A84C' : 'var(--border)'}`,
            borderRadius: '8px', padding: '1.5rem', textAlign: 'center',
            cursor: 'pointer', background: dragOver ? 'rgba(201,168,76,0.04)' : 'transparent',
            transition: 'all 150ms',
          }}
        >
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Processing…</span>
            </div>
          ) : (
            <>
              <Upload size={20} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                .xlsx or .csv format
              </div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search item no, description, barcode…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...SELECT_STYLE, width: '260px', padding: '0 0.75rem' }}
        />
        <select value={subGroup} onChange={(e) => setSubGroup(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Sub Groups</option>
          {subGroups.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {total > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {total.toLocaleString()} items
            </span>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.6 : 1 }}
          >
            {downloading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
            Download CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <Database size={32} style={{ color: 'var(--border)', margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              {total === 0 && !search ? 'No SAP items in registry' : 'No items match your filters'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {total === 0 && !search
                ? 'Upload a SAP item export above to populate this registry.'
                : 'Try adjusting your search or filters.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Item No.</th>
                  <th>Description</th>
                  <th>Sub Group</th>
                  <th>Bar Code</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#C9A84C', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{item.itemNo}</td>
                    <td style={{ fontWeight: 500, maxWidth: '320px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>{item.description}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.subGroup ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.barcode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', opacity: page === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
