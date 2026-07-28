'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Link2, AlertTriangle } from 'lucide-react';
import { WINE_FIELD_STYLE, formatRupiah, splitList } from './wineUi';

/** Mirrors what /api/wines/master-items/search returns: a full MasterItem plus the link flags. */
export interface MasterItemCandidate {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number | null;
  barcode: string | null;
  folder: string | null;
  uom: string | null;
  outlets: string | null;
  priceLevels: string | null;
  active: boolean;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  linkedWineId: string | null;
  linkedWineName: string | null;
}

/**
 * Step 1 of Add Wine. Searches the Master Item registry by name / PLU code / barcode; selecting an item
 * is the only way to start a Wine Master, because the Wine List never creates a PLU.
 *
 * Items already linked to an active Wine Master are shown but not selectable - seeing them (with the
 * wine that owns them) is more useful than an empty result the user can't explain.
 */
export function MasterItemPicker({
  onSelect,
  autoFocus = true,
}: {
  onSelect: (item: MasterItemCandidate) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MasterItemCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setItems([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ query: value.trim(), limit: '25' });
      const res = await fetch(`/api/wines/master-items/search?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <Search
          size={13}
          style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}
        />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            // A barcode scanner ends its input with Enter - search immediately instead of waiting
            // out the debounce.
            if (e.key === 'Enter') {
              e.preventDefault();
              clearTimeout(debounceRef.current);
              search(query);
            }
          }}
          placeholder="Cari nama item, PLU code, atau barcode..."
          style={{ ...WINE_FIELD_STYLE, paddingLeft: '1.8rem' }}
        />
      </div>

      {loading && (
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        </div>
      )}

      {!loading && searched && items.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Master Item tidak ditemukan. Wine List tidak membuat PLU baru - gunakan New Item Request
          terlebih dahulu, lalu publish dari Pending Publication.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>PLU Code</th>
                <th style={{ minWidth: '180px' }}>Item Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Barcode</th>
                <th>Outlets</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#C9A84C', fontWeight: 600 }}>
                      {item.code}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                    {item.name}
                    {!item.active && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: '#8B3A2A', fontWeight: 600 }}>
                        INACTIVE
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                  <td style={{ fontSize: '0.78rem' }}>{formatRupiah(item.price)}</td>
                  <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {item.barcode || '—'}
                  </td>
                  <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {splitList(item.outlets).join(', ') || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.linkedWineId ? (
                      <span
                        title={`Sudah terhubung dengan: ${item.linkedWineName ?? '-'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#8B3A2A' }}
                      >
                        <AlertTriangle size={11} /> Sudah terhubung
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                      >
                        <Link2 size={11} /> Pilih
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
