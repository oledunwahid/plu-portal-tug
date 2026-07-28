'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Search, Loader2, Send, AlertTriangle, ChevronLeft, ChevronRight, X, Inbox,
} from 'lucide-react';
import { WINE_MESSAGES } from '@/lib/wine';
import { canViewWineCost } from '@/lib/winePermissions';
import { WineForm, emptyWineFormValues, type WineFormMasterInfo, type WineFormSubmitPayload } from '@/components/wine/WineForm';
import { WINE_FIELD_STYLE, formatRupiah, formatDateTime, splitList } from '@/components/wine/wineUi';

interface PendingRow {
  requestId: string;
  itemName: string;
  code: string | null;
  barcode: string | null;
  category: string;
  department: string;
  price: number | null;
  outlets: string;
  requestorName: string | null;
  requestorOutlet: string | null;
  completedAt: string | null;
  masterItemId: string | null;
  masterItemName: string | null;
  masterItemActive: boolean | null;
}

interface PreviewMaster extends WineFormMasterInfo { id: string }

export default function PendingPublicationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canViewCost = canViewWineCost(session?.user as never);

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [active, setActive] = useState<PendingRow | null>(null);
  const [previewMaster, setPreviewMaster] = useState<PreviewMaster | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/wines/pending-publication?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setFailed(false);
    } catch {
      setRows([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim().length >= 2 ? value.trim() : '');
      setPage(1);
    }, 300);
  }

  /** Opens the publish preview: fetches the Master Item behind the request so the form can show it. */
  async function openPreview(row: PendingRow) {
    if (!row.masterItemId) {
      toast.error('Master Item untuk request ini belum tersedia di registry.');
      return;
    }
    setActive(row);
    setPreviewMaster(null);
    setPreviewLoading(true);
    try {
      // Reuse the master-item search to fetch the exact row by PLU code - it already returns every
      // read-only field the form needs.
      const params = new URLSearchParams({ query: row.code ?? row.itemName, limit: '25' });
      const res = await fetch(`/api/wines/master-items/search?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const found = (data.items ?? []).find((item: { id: string }) => item.id === row.masterItemId);
      if (!found) throw new Error('Master Item tidak ditemukan.');
      setPreviewMaster(found as PreviewMaster);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat preview.');
      setActive(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submitPublish(payload: WineFormSubmitPayload): Promise<Response> {
    return fetch(`/api/wines/publish-request/${active?.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (active && previewMaster) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setActive(null); setPreviewMaster(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}
        >
          <ChevronLeft size={13} /> Pending Publication
        </button>
        <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Publish to Wine List</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Request <span style={{ fontFamily: 'monospace' }}>{active.requestId.slice(0, 8).toUpperCase()}</span>
          {' · '}{active.itemName}{' · '}diselesaikan {formatDateTime(active.completedAt)}
        </p>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem',
            background: 'rgba(184,134,11,0.07)', border: '1px solid rgba(184,134,11,0.22)',
            borderRadius: '0.35rem', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#8B6914',
          }}
        >
          <AlertTriangle size={13} />
          Lengkapi data wine yang belum tersedia dari request. Satu request hanya dapat dipublikasikan
          satu kali.
        </div>

        <WineForm
          mode="publish"
          master={previewMaster}
          initialValues={{
            ...emptyWineFormValues(),
            // Seed the wine name from the request's item name - usually kept or lightly refined.
            wineName: active.itemName,
          }}
          canViewCost={canViewCost}
          submit={submitPublish}
          onSaved={(data) => {
            const wineId = (data as { wine?: { id?: string } })?.wine?.id;
            router.push(wineId ? `/wine/list/${wineId}` : '/wine/list');
          }}
          cancelHref="/wine/pending-publication"
          submitLabel="Publish to Wine List"
          successMessage="Request berhasil dipublikasikan ke Wine List."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Pending Publication</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Request wine berstatus DONE yang belum masuk ke Wine List.
      </p>

      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem' }}>
        <div style={{ position: 'relative', maxWidth: '340px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={handleSearch}
            placeholder="Cari request ID, item name, PLU, barcode..."
            style={{ ...WINE_FIELD_STYLE, paddingLeft: '1.8rem' }}
          />
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        {loading ? 'Memuat...' : `${total.toLocaleString('id-ID')} request menunggu publikasi`}
      </p>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading || previewLoading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : failed ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: '#8B3A2A', marginBottom: '0.75rem' }}>{WINE_MESSAGES.loadFailed}</p>
            <button type="button" onClick={load} className="btn-secondary">Coba kembali</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <Inbox size={26} style={{ color: 'var(--border)', marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '420px' }}>
              Tidak ada request wine yang menunggu publikasi. Request baru akan muncul di sini setelah
              admin menandainya DONE.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th style={{ minWidth: '190px' }}>Item Name</th>
                  <th>PLU Code</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Outlets</th>
                  <th>Requestor</th>
                  <th>Completion</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.requestId}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {row.requestId.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{row.itemName}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#C9A84C', fontWeight: 600 }}>
                        {row.code ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {row.barcode ?? '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.category}</td>
                    <td style={{ fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatRupiah(row.price)}
                    </td>
                    <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {splitList(row.outlets).join(', ') || '—'}
                    </td>
                    <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {row.requestorName ?? '—'}
                      {row.requestorOutlet ? ` · ${row.requestorOutlet}` : ''}
                    </td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.completedAt)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {row.masterItemId ? (
                        <button
                          type="button"
                          onClick={() => openPreview(row)}
                          className="btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                        >
                          <Send size={11} /> Publish
                        </button>
                      ) : (
                        <span
                          title="PLU code request ini belum ada di Master Item registry. Import master item terlebih dahulu."
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#8B3A2A' }}
                        >
                          <AlertTriangle size={11} /> Master Item belum ada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
        <Link href="/wine/list" style={{ color: '#8B6914', textDecoration: 'none' }}>Wine List</Link>
        {' · '}Publikasi tidak mengubah data request, hanya menandainya sudah terbit.
      </p>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
