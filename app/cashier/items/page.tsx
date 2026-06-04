'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface MasterItem {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number | null;
  outlets: string | null;
  active: boolean;
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

export default function CashierItemLookupPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const outletGroup = sessionUser?.outletGroup ?? '';

  const [items, setItems] = useState<MasterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
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
      .catch(() => {});
  }, []);

  // Load outlets for the cashier's group
  useEffect(() => {
    if (!outletGroup) return;
    fetch(`/api/config/outlets?group=${encodeURIComponent(outletGroup)}&activeOnly=true`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: { code: string }[]) => setOutletOptions(data.map((o) => o.code)))
      .catch(() => {});
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
                  <tr key={item.id}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
