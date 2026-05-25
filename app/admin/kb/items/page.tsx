'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, X, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

interface MasterItem {
  id: string; active: boolean; code: string; name: string;
  category: string; department: string; salesDef: string;
  price: number | null; plu: string | null; barcode: string | null;
  uom: string | null; folder: string | null;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
  printers: string | null; outlets: string | null; outletGroup: string | null;
  importedAt: string; updatedAt: string;
}

const BOOLEAN_FIELD = (v: boolean) => (
  <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600,
    background: v ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
    color: v ? '#2D4A2E' : '#7A2E1F', border: `1px solid ${v ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}` }}>
    {v ? 'Yes' : 'No'}
  </span>
);

function ItemSlideOver({ item, onClose }: { item: MasterItem; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'var(--bg-card)', zIndex: 50, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Item Detail</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{item.code}</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{item.category} · {item.department}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Price', value: item.price != null ? formatPrice(item.price) : '—' },
            { label: 'Status', value: item.active ? 'Active' : 'Inactive' },
            { label: 'Outlet Group', value: item.outletGroup ?? '—' },
            { label: 'Sales Def', value: item.salesDef },
            { label: 'PLU', value: item.plu ?? '—' },
            { label: 'Barcode', value: item.barcode ?? '—' },
            { label: 'UOM', value: item.uom ?? '—' },
            { label: 'Folder', value: item.folder ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ padding: '0.5rem 0.75rem' }}>
              <div className="label-caps" style={{ fontSize: '0.6rem', marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Flags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Service Charge: {BOOLEAN_FIELD(item.serviceCharge)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tax1: {BOOLEAN_FIELD(item.tax1)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tax2: {BOOLEAN_FIELD(item.tax2)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>No Discount: {BOOLEAN_FIELD(item.noDiscount)}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Hide Receipt: {BOOLEAN_FIELD(item.hideReceipt)}</span>
          </div>
        </div>

        {item.printers && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Printers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {item.printers.split(/[;,]/).filter(Boolean).map((p) => (
                <span key={p} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'var(--bg-cream)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{p.trim()}</span>
              ))}
            </div>
          </div>
        )}

        {item.outlets && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div className="label-caps" style={{ marginBottom: '0.375rem' }}>Outlets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {item.outlets.split(/[;,]/).filter(Boolean).map((o) => (
                <span key={o} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o.trim()}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
          Last imported: {new Date(item.importedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  height: '34px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '0 0.625rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
};

export default function MasterItemsPage() {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<MasterItem | null>(null);

  const [search, setSearch] = useState('');
  const [outletGroup, setOutletGroup] = useState('ALL');
  const [department, setDepartment] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ALL');

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(total / 50);

  const fetchItems = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set('search', search);
      if (outletGroup !== 'ALL') params.set('outletGroup', outletGroup);
      if (department !== 'ALL') params.set('department', department);
      if (activeFilter === 'ACTIVE') params.set('active', '1');
      else if (activeFilter === 'INACTIVE') params.set('active', '0');

      const res = await fetch(`/api/admin/kb/items?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setLastImported(data.lastImported ?? null);
      if (data.departments?.length > 0) setDepartments(data.departments);
    } catch {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [search, outletGroup, department, activeFilter, page]);

  useEffect(() => { fetchItems(1); setPage(1); }, [search, outletGroup, department, activeFilter]);
  useEffect(() => { fetchItems(page); }, [page]);

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/kb/items/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      const { inserted, updated, skipped } = data;
      let msg = `Registry updated — ${inserted} item${inserted !== 1 ? 's' : ''} imported, ${updated} updated`;
      if (skipped > 0) msg += `, ${skipped} skipped (malformed)`;
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

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Master Item Registry</h1>
        <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Source of truth for all PLU items imported from Quinos.
        </p>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Upload Quinos Export CSV</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Upload the latest item export from Quinos to keep this registry current.
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
              <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
              <span style={{ fontSize: '0.875rem' }}>Processing…</span>
            </div>
          ) : (
            <>
              <Upload size={20} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                Click to upload or drag and drop a CSV file
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                .csv format only
              </div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search code, name, category…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...SELECT_STYLE, width: '220px', padding: '0 0.75rem' }}
        />
        <select value={outletGroup} onChange={(e) => setOutletGroup(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Groups</option>
          <option value="IBR">IBR</option>
          <option value="UNION">UNION</option>
          <option value="CNS">CNS</option>
          <option value="FRENCH">FRENCH</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {total > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {total.toLocaleString()} items
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <Database size={32} style={{ color: 'var(--border)', margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              {total === 0 && !search ? 'No items in registry' : 'No items match your filters'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {total === 0 && !search
                ? 'Upload a Quinos export CSV above to populate this registry.'
                : 'Try adjusting your search or filters.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
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
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#C9A84C', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{item.code}</td>
                    <td style={{ fontWeight: 500, maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>{item.name}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.department}</td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.price != null ? formatPrice(item.price) : '—'}</td>
                    <td style={{ maxWidth: '160px' }}>
                      {item.outlets ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                          {item.outlets.split(/[;,]/).filter(Boolean).slice(0, 3).map((o) => (
                            <span key={o} style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: '2px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#8B6914' }}>{o.trim()}</span>
                          ))}
                          {item.outlets.split(/[;,]/).filter(Boolean).length > 3 && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>+{item.outlets.split(/[;,]/).filter(Boolean).length - 3}</span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                        background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                        color: item.active ? '#2D4A2E' : '#7A2E1F',
                        border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}` }}>
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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

      {activeItem && <ItemSlideOver item={activeItem} onClose={() => setActiveItem(null)} />}
    </div>
  );
}
