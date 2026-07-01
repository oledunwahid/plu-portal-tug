'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Upload, X, ChevronLeft, ChevronRight, Database, Pencil, Trash2, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { buildMasterReport, type ReportItem } from '@/lib/masterReport';
import { Switch } from '@/components/ui/switch';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

const EXPORT_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef', 'Price', 'PLU',
  'Barcode', 'UOM', 'Folder', 'ServiceCharge', 'Tax1', 'Tax2', 'NoDiscount',
  'HideReceipt', 'Printers', 'Outlets',
] as const;

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: '36px', border: '1px solid var(--input-border)', borderRadius: '4px',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.625rem',
  fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
};

interface MasterItem {
  id: string; active: boolean; code: string; name: string;
  category: string; department: string; salesDef: string;
  price: number | null; plu: string | null; barcode: string | null;
  uom: string | null; folder: string | null;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
  printers: string | null; outlets: string | null; outletGroup: string | null;
  priceLevels: string | null;
  importedAt: string; updatedAt: string;
}

const BOOLEAN_FIELD = (v: boolean) => (
  <span style={{
    fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600,
    background: v ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
    color: v ? '#2D4A2E' : '#7A2E1F', border: `1px solid ${v ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`
  }}>
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

function formatPriceInput(raw: string): string {
  if (!raw) return '';
  const n = parseInt(raw, 10);
  return isNaN(n) ? '' : n.toLocaleString('id-ID');
}

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label className="label-caps" style={{ fontSize: '0.62rem' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{hint}</span>}
    </div>
  );
}

interface EditForm {
  active: boolean; name: string; category: string; department: string; salesDef: string;
  price: string; plu: string; barcode: string; uom: string; folder: string;
  serviceCharge: boolean; tax1: boolean; tax2: boolean; noDiscount: boolean; hideReceipt: boolean;
  printers: string; outlets: string;
}

function EditItemSlideOver({ item, onClose, onSaved }: { item: MasterItem; onClose: () => void; onSaved: (updated: MasterItem) => void }) {
  const [form, setForm] = useState<EditForm>({
    active: item.active,
    name: item.name,
    category: item.category,
    department: item.department,
    salesDef: item.salesDef === 'MODIFIER' ? 'MODIFIER' : 'SALES',
    price: item.price != null ? String(item.price) : '',
    plu: item.plu ?? '',
    barcode: item.barcode ?? '',
    uom: item.uom ?? '',
    folder: item.folder ?? '',
    serviceCharge: item.serviceCharge,
    tax1: item.tax1,
    tax2: item.tax2,
    noDiscount: item.noDiscount,
    hideReceipt: item.hideReceipt,
    printers: item.printers ?? '',
    outlets: item.outlets ?? '',
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nama item harus diisi'); return; }
    setSaving(true);
    try {
      const body = {
        active: form.active,
        name: form.name.trim(),
        category: form.category.trim(),
        department: form.department.trim(),
        salesDef: form.salesDef,
        price: form.price === '' ? null : Number(form.price),
        plu: form.plu.trim() || null,
        barcode: form.barcode.trim() || null,
        uom: form.uom.trim() || null,
        folder: form.folder.trim() || null,
        serviceCharge: form.serviceCharge,
        tax1: form.tax1,
        tax2: form.tax2,
        noDiscount: form.noDiscount,
        hideReceipt: form.hideReceipt,
        printers: form.printers.trim() || null,
        outlets: form.outlets.trim() || null,
      };
      const res = await fetch(`/api/admin/kb/items/${encodeURIComponent(item.code)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal menyimpan'); }
      const updated = await res.json();
      onSaved(updated);
      toast.success('Item berhasil diperbarui');
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  }

  const TOGGLES: { key: keyof EditForm; label: string }[] = [
    { key: 'serviceCharge', label: 'Service Charge' },
    { key: 'tax1', label: 'Tax 1' },
    { key: 'tax2', label: 'Tax 2' },
    { key: 'noDiscount', label: 'No Discount' },
    { key: 'hideReceipt', label: 'Hide on Receipt' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '92vw', background: 'var(--bg-card)', zIndex: 50, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>Edit Item</h2>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{item.code}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Status Aktif
            <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
          </label>

          <Field label="Name"><input style={INPUT_STYLE} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Category"><input style={INPUT_STYLE} value={form.category} onChange={(e) => set('category', e.target.value)} /></Field>
          <Field label="Department"><input style={INPUT_STYLE} value={form.department} onChange={(e) => set('department', e.target.value)} /></Field>
          <Field label="Sales Def">
            <select style={INPUT_STYLE} value={form.salesDef} onChange={(e) => set('salesDef', e.target.value)}>
              <option value="SALES">SALES</option>
              <option value="MODIFIER">MODIFIER</option>
            </select>
          </Field>
          <Field label="Price">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rp</span>
              <input style={INPUT_STYLE} inputMode="numeric" value={formatPriceInput(form.price)} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} />
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="PLU"><input style={INPUT_STYLE} value={form.plu} onChange={(e) => set('plu', e.target.value)} /></Field>
            <Field label="Barcode"><input style={INPUT_STYLE} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} /></Field>
            <Field label="UOM"><input style={INPUT_STYLE} value={form.uom} onChange={(e) => set('uom', e.target.value)} /></Field>
            <Field label="Folder"><input style={INPUT_STYLE} value={form.folder} onChange={(e) => set('folder', e.target.value)} /></Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.25rem' }}>
            {TOGGLES.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {label}
                <Switch checked={form[key] as boolean} onCheckedChange={(v) => set(key, v as EditForm[typeof key])} />
              </label>
            ))}
          </div>

          <Field label="Printers" hint="Semicolon-separated, e.g. KITCHEN;BAR"><input style={INPUT_STYLE} value={form.printers} onChange={(e) => set('printers', e.target.value)} /></Field>
          <Field label="Outlets" hint="Semicolon-separated, e.g. CSPI;CSPP"><input style={INPUT_STYLE} value={form.outlets} onChange={(e) => set('outlets', e.target.value)} /></Field>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </>
  );
}

function DeleteConfirmDialog({ item, deleting, onCancel, onConfirm }: { item: MasterItem; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div onClick={deleting ? undefined : onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(420px, 92vw)', background: 'var(--bg-card)', borderRadius: '0.5rem', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', zIndex: 70, padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Hapus Item</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
          Hapus item <strong style={{ color: 'var(--text-primary)' }}>{item.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onCancel} disabled={deleting}
            style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            Batal
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.125rem', background: '#7A2E1F', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
            {deleting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {deleting ? 'Menghapus…' : 'Hapus'}
          </button>
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
  // COST_CONTROL has read-only access — write controls (upload, edit, delete, toggle) are hidden.
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN';
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
  const [outlet, setOutlet] = useState('ALL');
  const [allOutletCodes, setAllOutletCodes] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MasterItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'CSV' | 'XLSX' | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const totalPages = Math.ceil(total / 50);

  // Load all outlet codes for the outlet filter
  useEffect(() => {
    fetch('/api/config/outlets?activeOnly=true')
      .then((r) => r.ok ? r.json() : [])
      .then((data: { code: string }[]) => setAllOutletCodes(data.map((o) => o.code).sort()))
      .catch(() => { });
  }, []);

  const fetchItems = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set('search', search);
      if (outletGroup !== 'ALL') params.set('outletGroup', outletGroup);
      if (department !== 'ALL') params.set('department', department);
      if (outlet !== 'ALL') params.set('outlet', outlet);
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
  }, [search, outletGroup, department, outlet, activeFilter, page]);

  useEffect(() => { fetchItems(1); setPage(1); }, [search, outletGroup, department, outlet, activeFilter]);
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
      let msg = `Registry updated: ${inserted} item${inserted !== 1 ? 's' : ''} imported, ${updated} updated`;
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

  // Build the Quinos-format export rows (same column order as the import CSV).
  function buildExportRows(rows: MasterItem[]): Record<string, string | number>[] {
    const b = (v: boolean) => (v ? 1 : 0);
    return rows.map((r) => ({
      Active: b(r.active),
      Code: r.code,
      Name: r.name,
      Category: r.category,
      Department: r.department,
      SalesDef: r.salesDef ?? '',
      Price: r.price ?? '',
      PLU: r.plu ?? '',
      Barcode: r.barcode ?? '',
      UOM: r.uom ?? '',
      Folder: r.folder ?? '',
      ServiceCharge: b(r.serviceCharge),
      Tax1: b(r.tax1),
      Tax2: b(r.tax2),
      NoDiscount: b(r.noDiscount),
      HideReceipt: b(r.hideReceipt),
      Printers: r.printers ?? '',
      Outlets: r.outlets ?? '',
    }));
  }

  async function fetchAllFiltered(): Promise<MasterItem[]> {
    const params = new URLSearchParams({ export: 'true' });
    if (search) params.set('search', search);
    if (outletGroup !== 'ALL') params.set('outletGroup', outletGroup);
    if (department !== 'ALL') params.set('department', department);
    if (outlet !== 'ALL') params.set('outlet', outlet);
    if (activeFilter === 'ACTIVE') params.set('active', '1');
    else if (activeFilter === 'INACTIVE') params.set('active', '0');
    const res = await fetch(`/api/admin/kb/items?${params}`);
    if (!res.ok) throw new Error('Gagal mengambil data');
    const data = await res.json();
    return (data.items ?? []) as MasterItem[];
  }

  async function handleDownload(format: 'CSV' | 'XLSX') {
    setDownloadingFormat(format);
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) { toast.error('Tidak ada item untuk diekspor'); return; }
      const rows = buildExportRows(all);
      const date = new Date().toISOString().slice(0, 10);
      const headers = [...EXPORT_HEADERS];

      if (format === 'CSV') {
        const escape = (v: string | number) => {
          const s = String(v ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [
          headers.join(','),
          ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(',')),
        ].join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `master-items-${date}.csv`);
      } else {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        ws['!cols'] = headers.map(() => ({ wch: 15 }));
        ws['!cols'][2] = { wch: 30 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Master Items');
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `master-items-${date}.xlsx`);
      }
      toast.success(`${format} diunduh: ${all.length.toLocaleString()} item`);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal mengunduh');
    } finally {
      setDownloadingFormat(null);
    }
  }

  async function handleMasterReport() {
    setGeneratingReport(true);
    const toastId = toast.loading('Membuat Master Report… ini bisa memakan beberapa detik.');
    try {
      // Pull all active items (no pagination) for the full report.
      const res = await fetch('/api/admin/kb/items?activeOnly=true&limit=99999');
      if (!res.ok) throw new Error('Gagal mengambil data item');
      const data = await res.json();
      const items = (data.items ?? []) as ReportItem[];
      if (items.length === 0) { toast.error('Tidak ada item aktif untuk dilaporkan', { id: toastId }); return; }

      const report = buildMasterReport(items);
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const allItemWs = XLSX.utils.aoa_to_sheet(report.allItem);
      XLSX.utils.book_append_sheet(wb, allItemWs, 'ALL ITEM');
      for (const sheet of report.outletSheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.aoa);
        // Sheet names are capped at 31 chars by the XLSX spec; outlet codes are short.
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
      }

      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `master-all-item-${date}.xlsx`,
      );
      toast.success(`Master Report dibuat: ${items.length.toLocaleString('id-ID')} item`, { id: toastId });
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal membuat Master Report', { id: toastId });
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleDelete(item: MasterItem) {
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/admin/kb/items/${encodeURIComponent(item.code)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal menghapus'); }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success('Item berhasil dihapus');
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal menghapus item');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(item: MasterItem) {
    const next = !item.active;
    if (!window.confirm(`Ubah status item ini menjadi ${next ? 'Aktif' : 'Nonaktif'}?`)) return;
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/admin/kb/items/${encodeURIComponent(item.code)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal'); }
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: updated.active } : i)));
      toast.success(`Status item diubah menjadi ${next ? 'Aktif' : 'Nonaktif'}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal mengubah status');
    } finally {
      setTogglingId(null);
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

      {/* Upload card — admin only (cost control is read-only). */}
      {isAdmin && (
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
      )}

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
        <select value={outlet} onChange={(e) => setOutlet(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Outlets</option>
          {allOutletCodes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={SELECT_STYLE}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          {total > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {total.toLocaleString()} items
            </span>
          )}
          <button
            onClick={() => handleDownload('CSV')}
            disabled={downloadingFormat !== null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', cursor: downloadingFormat !== null ? 'not-allowed' : 'pointer', opacity: downloadingFormat !== null ? 0.6 : 1 }}
          >
            {downloadingFormat === 'CSV' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
            Download CSV
          </button>
          <button
            onClick={() => handleDownload('XLSX')}
            disabled={downloadingFormat !== null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.875rem', background: 'var(--bg-dark)', border: 'none', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-gold)', cursor: downloadingFormat !== null ? 'not-allowed' : 'pointer', opacity: downloadingFormat !== null ? 0.6 : 1 }}
          >
            {downloadingFormat === 'XLSX' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
            Download XLSX
          </button>
          <button
            onClick={handleMasterReport}
            disabled={generatingReport}
            title="Buat laporan Master All Item lengkap dengan sheet per outlet"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '34px', padding: '0 0.875rem', background: 'var(--bg-dark)', border: 'none', borderRadius: '0.375rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-gold)', cursor: generatingReport ? 'not-allowed' : 'pointer', opacity: generatingReport ? 0.6 : 1 }}
          >
            {generatingReport ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={13} />}
            Master Report
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={8} cols={8} />
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
                  <th style={{ textAlign: 'right' }}>Actions</th>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <button
                          onClick={() => handleToggleActive(item)}
                          disabled={togglingId === item.id}
                          title="Klik untuk mengubah status"
                          style={{
                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                            background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                            color: item.active ? '#2D4A2E' : '#7A2E1F',
                            border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`,
                            cursor: togglingId === item.id ? 'wait' : 'pointer', opacity: togglingId === item.id ? 0.6 : 1
                          }}>
                          {item.active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span style={{
                          fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 600,
                          background: item.active ? 'rgba(61,90,62,0.1)' : 'rgba(122,46,31,0.08)',
                          color: item.active ? '#2D4A2E' : '#7A2E1F',
                          border: `1px solid ${item.active ? 'rgba(61,90,62,0.2)' : 'rgba(122,46,31,0.15)'}`,
                        }}>
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => setEditItem(item)}
                              title="Edit item"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(item)}
                              disabled={deletingId === item.id}
                              title="Hapus item"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'transparent', border: '1px solid rgba(122,46,31,0.25)', borderRadius: '4px', cursor: deletingId === item.id ? 'not-allowed' : 'pointer', color: '#7A2E1F', opacity: deletingId === item.id ? 0.5 : 1 }}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </div>
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

      {editItem && (
        <EditItemSlideOver
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmDialog
          item={confirmDelete}
          deleting={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
