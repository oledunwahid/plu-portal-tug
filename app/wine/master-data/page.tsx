'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, Plus, Search, Check, X, Pencil } from 'lucide-react';
import {
  WINE_MASTER_DATA_TYPES, WINE_MASTER_DATA_LABELS, normalizeWineText, WINE_MESSAGES,
  type WineMasterDataType,
} from '@/lib/wine';
import { WINE_FIELD_STYLE } from '@/components/wine/wineUi';

interface Item {
  id: string;
  type: string;
  code: string | null;
  name: string;
  normalizedName: string;
  status: string;
  updatedAt: string;
}

/**
 * Wine reference-data management. Duplicate prevention is by normalized name (case, accents and minor
 * punctuation folded), which is why "Bouchard Père & Fils" and "BOUCHARD PERE & FILS" cannot both
 * exist - the form warns before submitting and the server enforces it with a unique index.
 */
export default function WineMasterDataPage() {
  const [type, setType] = useState<WineMasterDataType>('PRODUCER');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wine-master-data/${type}?includeInactive=1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
      setFailed(false);
    } catch {
      setItems([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeWineText(search);
    if (!q) return items;
    return items.filter((i) => i.normalizedName.includes(q));
  }, [items, search]);

  // Local pre-check so the user sees the clash before a request round trip; the server owns the rule.
  const normalizedNew = normalizeWineText(newName);
  const localClash = normalizedNew ? items.find((i) => i.normalizedName === normalizedNew) ?? null : null;

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    if (localClash) {
      toast.error(`"${localClash.name}" sudah terdaftar dengan nama yang sama.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/wine-master-data/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menambah data.');
      toast.success(`${data.item.name} ditambahkan.`);
      setNewName('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah data.');
    } finally {
      setCreating(false);
    }
  }

  async function patch(item: Item, body: Record<string, unknown>, successMessage: string) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/wine-master-data/${item.type}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menyimpan.');
      toast.success(successMessage);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Link
        href="/wine/list"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem' }}
      >
        <ChevronLeft size={13} /> Wine List
      </Link>
      <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Master Data Wine</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Daftar referensi untuk dropdown wine. Duplikat dicegah berdasarkan nama yang dinormalisasi —
        huruf besar/kecil, aksen dan tanda baca minor dianggap sama.
      </p>

      {/* Type tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
        {WINE_MASTER_DATA_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setSearch(''); setNewName(''); setEditingId(null); }}
            style={{
              padding: '0.35rem 0.7rem', borderRadius: '0.3rem', fontSize: '0.75rem',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1px solid ${t === type ? 'rgba(201,168,76,0.5)' : 'var(--border)'}`,
              background: t === type ? 'rgba(201,168,76,0.12)' : 'var(--bg-card)',
              color: t === type ? '#8B6914' : 'var(--text-secondary)',
              fontWeight: t === type ? 600 : 400,
            }}
          >
            {WINE_MASTER_DATA_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Add + search */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 260px', minWidth: '200px' }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
              placeholder={`Nama ${WINE_MASTER_DATA_LABELS[type].toLowerCase()} baru...`}
              style={{
                ...WINE_FIELD_STYLE,
                borderColor: localClash ? '#8B3A2A' : 'var(--input-border)',
              }}
            />
            {localClash && (
              <p style={{ fontSize: '0.72rem', color: '#8B3A2A', margin: '0.3rem 0 0' }}>
                &ldquo;{localClash.name}&rdquo; sudah terdaftar dengan nama yang sama.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newName.trim() || Boolean(localClash)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            {creating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
            Tambah
          </button>
          <div style={{ position: 'relative', flex: '0 1 220px' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari..."
              style={{ ...WINE_FIELD_STYLE, paddingLeft: '1.8rem' }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : failed ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: '#8B3A2A', marginBottom: '0.75rem' }}>{WINE_MESSAGES.loadFailed}</p>
            <button type="button" onClick={load} className="btn-secondary">Coba kembali</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {search ? 'Tidak ada data yang cocok.' : `Belum ada data ${WINE_MASTER_DATA_LABELS[type].toLowerCase()}.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Name</th>
                  <th>Normalized</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                      {editingId === item.id ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') patch(item, { name: editingName.trim() }, 'Nama diperbarui.');
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{ ...WINE_FIELD_STYLE, height: '28px', fontSize: '0.8rem' }}
                        />
                      ) : item.name}
                    </td>
                    <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {item.normalizedName}
                    </td>
                    <td style={{ fontSize: '0.74rem', color: item.status === 'Active' ? '#2D4A2E' : 'var(--text-secondary)' }}>
                      {item.status}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {busyId === item.id ? (
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
                      ) : editingId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => patch(item, { name: editingName.trim() }, 'Nama diperbarui.')}
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.4rem', marginRight: '0.3rem' }}
                            aria-label="Simpan"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.4rem' }}
                            aria-label="Batal"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setEditingId(item.id); setEditingName(item.name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B6914', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginRight: '0.6rem' }}
                          >
                            <Pencil size={11} /> Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => patch(
                              item,
                              { status: item.status === 'Active' ? 'Inactive' : 'Active' },
                              `Status ${item.name} diperbarui.`,
                            )}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.72rem' }}
                          >
                            {item.status === 'Active' ? 'Set Inactive' : 'Set Active'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
        {filtered.length.toLocaleString('id-ID')} dari {items.length.toLocaleString('id-ID')} data.
        Data Inactive tetap tersimpan dan tidak muncul pada dropdown wine.
      </p>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
