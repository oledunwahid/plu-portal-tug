'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { parsePriceLevels } from '@/lib/priceLevels';

interface MasterItem {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number | null;
  outlets: string | null;
  active: boolean;
  barcode: string | null;
  folder: string | null;
  salesDef: string;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  printers: string | null;
  priceLevels: string | null;
}

interface ConfigCategory {
  id: string; name: string; department: string; departmentCode: number; categoryCode: number; isActive: boolean;
}

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.625rem',
  fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

const PAGE_SIZE = 20;

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.55rem',
      borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase',
      background: active ? 'rgba(61,90,62,0.1)' : 'rgba(100,100,100,0.08)',
      color: active ? '#2D4A2E' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'rgba(61,90,62,0.25)' : 'var(--border)'}`,
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function BoolPill({ value }: { value: boolean }) {
  return (
    <span style={{
      fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', fontWeight: 600,
      background: value ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
      color: value ? '#2D4A2E' : '#7A2E1F',
      border: `1px solid ${value ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`,
    }}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

// Read-only detail panel - cashiers can inspect but never edit an item.
function ItemDetailSlideOver({ item, onClose }: { item: MasterItem; onClose: () => void }) {
  const priceLevels = parsePriceLevels(item.priceLevels);
  const outletList = item.outlets ? item.outlets.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
  const printerList = item.printers ? item.printers.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '92vw', background: 'var(--bg-card)', zIndex: 50, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>Item Detail</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{item.code}</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{item.category} · {item.department}</div>
        <div style={{ marginBottom: '1rem' }}><StatusBadge active={item.active} /></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Price', value: item.price != null ? `Rp ${item.price.toLocaleString('id-ID')}` : '—' },
            { label: 'Sales Def', value: item.salesDef || '—' },
            { label: 'Barcode', value: item.barcode || '—' },
            { label: 'Folder', value: item.folder || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ padding: '0.5rem 0.75rem' }}>
              <div className="label-caps" style={{ fontSize: '0.6rem', marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Flags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Service Charge <BoolPill value={item.serviceCharge} /></span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Tax 1 <BoolPill value={item.tax1} /></span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Tax 2 <BoolPill value={item.tax2} /></span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>No Discount <BoolPill value={item.noDiscount} /></span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Hide Receipt <BoolPill value={item.hideReceipt} /></span>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Printers</div>
          {printerList.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {printerList.map((p) => (
                <span key={p} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'var(--bg-cream)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{p}</span>
              ))}
            </div>
          ) : <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>—</span>}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Outlets</div>
          {outletList.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {outletList.map((o) => (
                <span key={o} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o}</span>
              ))}
            </div>
          ) : <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>—</span>}
        </div>

        {priceLevels.entries.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Price Levels</div>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: '0.6rem', textAlign: 'left', padding: '0.3rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Outlet Type</th>
                    <th style={{ fontSize: '0.6rem', textAlign: 'left', padding: '0.3rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Outlet Group</th>
                    <th style={{ fontSize: '0.6rem', textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLevels.entries.map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem', color: 'var(--text-primary)' }}>{e.outletType || '—'}</td>
                      <td style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem', color: 'var(--text-secondary)' }}>{e.outletGroup || '—'}</td>
                      <td style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{e.price.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function CashierItemLookupPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const outletGroup = sessionUser?.outletGroup ?? '';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<MasterItem | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [outlet, setOutlet] = useState('');
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [outletOptions, setOutletOptions] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load categories
  useEffect(() => {
    fetch('/api/config/categories?activeOnly=true')
      .then((r) => r.ok ? r.json() : [])
      .then((data: ConfigCategory[]) => setCategories(data))
      .catch(() => { });
  }, []);

  // Load outlets for the cashier's group
  useEffect(() => {
    if (!outletGroup) return;
    fetch(`/api/config/outlets?group=${encodeURIComponent(outletGroup)}&activeOnly=true`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { code: string }[]) => setOutletOptions(data.map((o) => o.code)))
      .catch(() => { });
  }, [outletGroup]);

  // Derive unique departments from categories
  const departments = Array.from(new Set(categories.map((c) => c.department))).sort();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search && search.length >= 2) params.set('search', search);
      if (category) params.set('category', category);
      if (department) params.set('department', department);
      if (outlet) params.set('outlet', outlet);
      // Cashiers must never see inactive items - always scope the lookup to active items.
      params.set('active', '1');
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/admin/kb/items?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, department, outlet, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val.length >= 2 ? val : '');
      setPage(1);
    }, 300);
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setCategory(val);
    if (val) {
      const cat = categories.find((c) => c.name === val);
      if (cat) setDepartment(cat.department);
    }
    setPage(1);
  }

  function handleDepartmentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDepartment(e.target.value);
    setCategory(''); // clear category when department changed independently
    setPage(1);
  }

  function handleOutletChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setOutlet(e.target.value);
    setPage(1);
  }

  function handleReset() {
    setSearchInput('');
    setSearch('');
    setCategory('');
    setDepartment('');
    setOutlet('');
    setPage(1);
  }

  const hasFilters = !!(search || category || department || outlet);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Item Lookup</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
        Cari item PLU yang sudah terdaftar di sistem.
      </p>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <Search size={13} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Cari kode atau nama item..."
            style={{ ...SELECT_STYLE, width: '100%', paddingLeft: '1.75rem', cursor: 'text' }}
          />
        </div>
        <select value={category} onChange={handleCategoryChange} style={SELECT_STYLE}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select value={department} onChange={handleDepartmentChange} style={SELECT_STYLE}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={outlet} onChange={handleOutletChange} style={SELECT_STYLE}>
          <option value="">All Outlets</option>
          {outletOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={handleReset}
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Count */}
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        {loading ? 'Memuat...' : `${total.toLocaleString('id-ID')} item ditemukan`}
      </p>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {hasFilters ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada item terdaftar.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th style={{ minWidth: '200px' }}>Name</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Price</th>
                  <th>Outlets</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => setActiveItem(item)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#C9A84C', fontWeight: 600, letterSpacing: '0.03em' }}>
                        {item.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.department}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {item.price != null ? `Rp ${item.price.toLocaleString('id-ID')}` : '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.outlets ? item.outlets.split(';').filter(Boolean).join(', ') : '—'}
                    </td>
                    <td><StatusBadge active={item.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.25rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {activeItem && <ItemDetailSlideOver item={activeItem} onClose={() => setActiveItem(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
