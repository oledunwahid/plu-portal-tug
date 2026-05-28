'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Loader2, X, AlertTriangle } from 'lucide-react';

type Tab = 'outlets' | 'printers' | 'categories';

interface OutletConfig { id: string; code: string; group: string; isActive: boolean; }
interface PrinterConfig { id: string; name: string; group: string; isActive: boolean; }
interface CategoryConfig { id: string; name: string; department: string; departmentCode: number; categoryCode: number; isActive: boolean; }

const OUTLET_GROUPS = ['UNION', 'CNS', 'FRENCH', 'IBR', 'IND'];
const PRINTER_GROUPS = ['Kitchen', 'Bar', 'Service', 'Specialty', 'Event'];

// ── Shared ────────────────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: '999px',
      fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em',
      background: active ? 'rgba(100,180,100,0.15)' : 'rgba(180,80,80,0.15)',
      color: active ? '#6ab06a' : '#c07070',
    }}>
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}

function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100vw',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 201,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </>
  );
}

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
      <label className="label-caps">{label}{required && <span style={{ color: '#7A2E1F', marginLeft: '0.2rem' }}>*</span>}</label>
      {children}
      {error && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', margin: 0 }}>{error}</p>}
    </div>
  );
}

const inputCls = 'flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200';

// ── Outlets Tab ───────────────────────────────────────────────────────────────

function OutletsTab() {
  const [outlets, setOutlets] = useState<OutletConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<OutletConfig | null>(null);
  const [form, setForm] = useState({ code: '', group: 'UNION' });
  const [errors, setErrors] = useState<{ code?: string; group?: string }>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/outlets');
      if (!res.ok) throw new Error();
      setOutlets(await res.json());
    } catch {
      toast.error('Failed to load outlets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ code: '', group: 'UNION' }); setErrors({}); setSlideOpen(true); }
  function openEdit(o: OutletConfig) { setEditing(o); setForm({ code: o.code, group: o.group }); setErrors({}); setSlideOpen(true); }

  async function handleSave() {
    const errs: typeof errors = {};
    if (!form.code.trim()) errs.code = 'Code is required';
    if (!form.group) errs.group = 'Group is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/config/outlets/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: form.code.trim().toUpperCase(), group: form.group }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Outlet updated');
      } else {
        const res = await fetch('/api/config/outlets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: form.code.trim().toUpperCase(), group: form.group }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Outlet added');
      }
      setSlideOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(o: OutletConfig) {
    if (!confirm(`Deactivate outlet ${o.code}?`)) return;
    try {
      await fetch(`/api/config/outlets/${o.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      toast.success(`${o.code} deactivated`);
      load();
    } catch {
      toast.error('Failed to deactivate');
    }
  }

  async function handleReactivate(o: OutletConfig) {
    try {
      await fetch(`/api/config/outlets/${o.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      toast.success(`${o.code} reactivated`);
      load();
    } catch {
      toast.error('Failed to reactivate');
    }
  }

  const filtered = outlets.filter((o) => {
    const q = filter.toLowerCase();
    return (groupFilter === 'ALL' || o.group === groupFilter) &&
      (o.code.toLowerCase().includes(q) || o.group.toLowerCase().includes(q));
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search code..." className={inputCls} style={{ maxWidth: '200px' }} />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={inputCls} style={{ maxWidth: '160px' }}>
          <option value="ALL">All Groups</option>
          {OUTLET_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', height: '40px', background: 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={14} /> Add Outlet
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Code', 'Group', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No outlets found</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{o.code}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{o.group}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><Badge active={o.isActive} /></td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex' }}><Pencil size={13} /></button>
                      {o.isActive
                        ? <button onClick={() => handleDeactivate(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c07070', fontSize: '0.7rem', padding: '2px' }}>Deactivate</button>
                        : <button onClick={() => handleReactivate(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6ab06a', fontSize: '0.7rem', padding: '2px' }}>Reactivate</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? 'Edit Outlet' : 'Add Outlet'}>
        <Field label="Outlet Code" required error={errors.code}>
          <input value={form.code} onChange={(e) => { setForm((f) => ({ ...f, code: e.target.value })); setErrors((e) => ({ ...e, code: undefined })); }}
            placeholder="e.g. UTP" className={inputCls} />
        </Field>
        <Field label="Group" required error={errors.group}>
          <select value={form.group} onChange={(e) => { setForm((f) => ({ ...f, group: e.target.value })); setErrors((e) => ({ ...e, group: undefined })); }} className={inputCls}>
            {OUTLET_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <button onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.625rem 1.5rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </SlideOver>
    </>
  );
}

// ── Printers Tab ──────────────────────────────────────────────────────────────

function PrintersTab() {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterConfig | null>(null);
  const [form, setForm] = useState({ name: '', group: 'Kitchen' });
  const [errors, setErrors] = useState<{ name?: string; group?: string }>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/printers');
      if (!res.ok) throw new Error();
      setPrinters(await res.json());
    } catch {
      toast.error('Failed to load printers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ name: '', group: 'Kitchen' }); setErrors({}); setSlideOpen(true); }
  function openEdit(p: PrinterConfig) { setEditing(p); setForm({ name: p.name, group: p.group }); setErrors({}); setSlideOpen(true); }

  async function handleSave() {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.group) errs.group = 'Group is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/config/printers/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim().toUpperCase(), group: form.group }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Printer updated');
      } else {
        const res = await fetch('/api/config/printers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim().toUpperCase(), group: form.group }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Printer added');
      }
      setSlideOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PrinterConfig) {
    if (p.isActive && !confirm(`Deactivate printer ${p.name}?`)) return;
    try {
      await fetch(`/api/config/printers/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      toast.success(p.isActive ? `${p.name} deactivated` : `${p.name} reactivated`);
      load();
    } catch {
      toast.error('Failed to update');
    }
  }

  const filtered = printers.filter((p) => {
    const q = filter.toLowerCase();
    return (groupFilter === 'ALL' || p.group === groupFilter) &&
      (p.name.toLowerCase().includes(q) || p.group.toLowerCase().includes(q));
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name..." className={inputCls} style={{ maxWidth: '200px' }} />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={inputCls} style={{ maxWidth: '160px' }}>
          <option value="ALL">All Groups</option>
          {PRINTER_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', height: '40px', background: 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={14} /> Add Printer
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Group', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No printers found</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{p.group}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><Badge active={p.isActive} /></td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex' }}><Pencil size={13} /></button>
                      <button onClick={() => toggleActive(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.isActive ? '#c07070' : '#6ab06a', fontSize: '0.7rem', padding: '2px' }}>
                        {p.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? 'Edit Printer' : 'Add Printer'}>
        <Field label="Printer Name" required error={errors.name}>
          <input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((e) => ({ ...e, name: undefined })); }}
            placeholder="e.g. KITCHEN1" className={inputCls} />
        </Field>
        <Field label="Group" required error={errors.group}>
          <select value={form.group} onChange={(e) => { setForm((f) => ({ ...f, group: e.target.value })); setErrors((e) => ({ ...e, group: undefined })); }} className={inputCls}>
            {PRINTER_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <button onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.625rem 1.5rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </SlideOver>
    </>
  );
}

// ── Categories Tab ────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  'FOOD', 'ALCOHOLIC BEVERAGES', 'COCKTAILS', 'NON ALCOHOLIC BEVERAGES',
  'WINE', 'PASTRY', 'BAKERY', 'CIGAR-ETTES', 'MISCELLANEOUS',
];

function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryConfig | null>(null);
  const [form, setForm] = useState({ name: '', department: 'FOOD', departmentCode: '', categoryCode: '' });
  const [errors, setErrors] = useState<{ name?: string; department?: string; departmentCode?: string; categoryCode?: string }>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/categories');
      if (!res.ok) throw new Error();
      setCategories(await res.json());
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ name: '', department: 'FOOD', departmentCode: '', categoryCode: '' }); setErrors({}); setSlideOpen(true); }
  function openEdit(c: CategoryConfig) {
    setEditing(c);
    setForm({ name: c.name, department: c.department, departmentCode: String(c.departmentCode), categoryCode: String(c.categoryCode) });
    setErrors({}); setSlideOpen(true);
  }

  async function handleSave() {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.department) errs.department = 'Department is required';
    if (!form.departmentCode || isNaN(Number(form.departmentCode))) errs.departmentCode = 'Valid department code required';
    if (!form.categoryCode || isNaN(Number(form.categoryCode))) errs.categoryCode = 'Valid category code required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/config/categories/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), department: form.department, departmentCode: Number(form.departmentCode), categoryCode: Number(form.categoryCode) }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Category updated');
      } else {
        const res = await fetch('/api/config/categories', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), department: form.department, departmentCode: Number(form.departmentCode), categoryCode: Number(form.categoryCode) }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
        toast.success('Category added');
      }
      setSlideOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: CategoryConfig) {
    if (c.isActive && !confirm(`Deactivate category "${c.name}"?`)) return;
    try {
      await fetch(`/api/config/categories/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      toast.success(c.isActive ? `"${c.name}" deactivated` : `"${c.name}" reactivated`);
      load();
    } catch {
      toast.error('Failed to update');
    }
  }

  const filtered = categories.filter((c) => {
    const q = filter.toLowerCase();
    return (deptFilter === 'ALL' || c.department === deptFilter) &&
      (c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q));
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search category..." className={inputCls} style={{ maxWidth: '200px' }} />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={inputCls} style={{ maxWidth: '240px' }}>
          <option value="ALL">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', height: '40px', background: 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
          <Plus size={14} /> Add Category
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Category', 'Department', 'Dept Code', 'Cat Code', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No categories found</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{c.department}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.departmentCode}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.categoryCode}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><Badge active={c.isActive} /></td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex' }}><Pencil size={13} /></button>
                      <button onClick={() => toggleActive(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.isActive ? '#c07070' : '#6ab06a', fontSize: '0.7rem', padding: '2px' }}>
                        {c.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <Field label="Category Name" required error={errors.name}>
          <input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((e) => ({ ...e, name: undefined })); }}
            placeholder="e.g. Asian" className={inputCls} />
        </Field>
        <Field label="Department" required error={errors.department}>
          <select value={form.department} onChange={(e) => { setForm((f) => ({ ...f, department: e.target.value })); setErrors((e) => ({ ...e, department: undefined })); }} className={inputCls}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Department Code" required error={errors.departmentCode}>
          <input type="number" value={form.departmentCode} onChange={(e) => { setForm((f) => ({ ...f, departmentCode: e.target.value })); setErrors((e) => ({ ...e, departmentCode: undefined })); }}
            placeholder="e.g. 10" className={inputCls} />
        </Field>
        <Field label="Category Code" required error={errors.categoryCode}>
          <input type="number" value={form.categoryCode} onChange={(e) => { setForm((f) => ({ ...f, categoryCode: e.target.value })); setErrors((e) => ({ ...e, categoryCode: undefined })); }}
            placeholder="e.g. 101" className={inputCls} />
        </Field>
        <button onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.625rem 1.5rem', background: saving ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </SlideOver>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('outlets');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'outlets', label: 'Outlets' },
    { key: 'printers', label: 'Printers' },
    { key: 'categories', label: 'Categories' },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Configuration</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Manage outlets, printers, and categories.
      </p>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem',
        background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: '0.5rem', marginBottom: '1.5rem',
      }}>
        <AlertTriangle size={15} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Perubahan pada halaman ini belum diterapkan ke form kasir. Sistem masih menggunakan konfigurasi bawaan.
          Hubungi tim teknis untuk mengaktifkan fase berikutnya.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.625rem 1.25rem', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent-gold)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer', marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'outlets' && <OutletsTab />}
      {tab === 'printers' && <PrintersTab />}
      {tab === 'categories' && <CategoriesTab />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
