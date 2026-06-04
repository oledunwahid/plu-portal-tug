'use client';

import { useState, useEffect, useRef } from 'react';
import { ScanBarcode } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

interface MasterItem {
  id: string; active: boolean; code: string; name: string;
  category: string; department: string; price: number | null;
  outlets: string | null; outletGroup: string | null;
}

function ItemCard({ item }: { item: MasterItem }) {
  const outlets = (item.outlets ?? '').split(/[;,]/).filter(Boolean);
  return (
    <div className="card" style={{ padding: '0.875rem 1.125rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{item.code}</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.category} · {item.department}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            {item.price != null ? formatPrice(item.price) : '—'}
          </div>
          <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
            background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
            color: item.active ? '#2D4A2E' : '#7A2E1F',
            border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}` }}>
            {item.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      {outlets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '0.5rem' }}>
          {outlets.map((o) => (
            <span key={o} style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o.trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BarcodeLookupPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MasterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [registryEmpty, setRegistryEmpty] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if registry is empty on mount
  useEffect(() => {
    fetch('/api/admin/kb/items?page=1')
      .then((r) => r.json())
      .then((d) => setRegistryEmpty((d.total ?? 0) === 0))
      .catch(() => {});
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setItems([]); setTotal(0); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/kb/barcode?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setItems([]); setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  if (registryEmpty === true) {
    return (
      <div style={{ maxWidth: '560px', margin: '3rem auto', textAlign: 'center' }}>
        <ScanBarcode size={40} style={{ color: 'var(--border)', margin: '0 auto 0.875rem' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Registry is empty</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          No items have been imported yet. Upload a Quinos export CSV first.
        </p>
        <Link href="/admin/kb/items"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#1A1008', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
          Go to Master Items
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Barcode Lookup</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Search the master registry by code, barcode, PLU number, or name.
        </p>
      </div>

      {/* Search input */}
      <div style={{ maxWidth: '600px', margin: '0 auto 1.5rem', position: 'relative' }}>
        <ScanBarcode size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, barcode, or name…"
          style={{
            width: '100%', height: '50px', paddingLeft: '2.75rem', paddingRight: '1rem',
            borderRadius: '8px', border: '1.5px solid var(--input-border)',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {query.trim() && !loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No items found for &ldquo;{query}&rdquo;. The item may not be in the current registry.
            Try uploading a fresh Quinos export.
          </div>
        )}

        {items.map((item) => <ItemCard key={item.id} item={item} />)}

        {total > 10 && (
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
            Showing 10 of {total.toLocaleString()} results. Refine your search for more precise matches.
          </div>
        )}
      </div>
    </div>
  );
}
