'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { getCategoriesForOutlet, getDepartmentForCategory } from '@/lib/categories';
import { PRINTERS_BY_GROUP, OUTLETS_BY_GROUP, OutletGroup, PRINTER_GROUPS } from '@/lib/outlets';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { SuccessModal } from '@/components/SuccessModal';
import Link from 'next/link';

interface FormState {
  name: string;
  category: string;
  department: string;
  price: string;
  folder: string;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  printers: string[];
  outlets: string[];
  remarks: string;
}

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="label-caps">{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

export default function EditRequestPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormState | null>(null);
  const [requestType, setRequestType] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successModal, setSuccessModal] = useState({ open: false, itemName: '' });

  const sessionUser = session?.user as any;
  const outlet = sessionUser?.outlet ?? 'ROMSCBD';
  const outletGroup = (sessionUser?.outletGroup as OutletGroup) ?? 'IBR';

  const categories = getCategoriesForOutlet(outlet);
  const availablePrinters = new Set(PRINTERS_BY_GROUP[outletGroup] ?? []);
  const outlets = OUTLETS_BY_GROUP[outletGroup] ?? [];

  const categoryOptions = categories.map((c) => ({
    value: c.category,
    label: c.category,
    group: c.department,
  }));

  const needsPrice = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRICE';

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/requests/${id}`);
        if (!res.ok) {
          if (res.status === 409) { router.replace('/cashier/dashboard'); return; }
          throw new Error('Failed to load');
        }
        const data = await res.json();
        if (data.status === 'DONE') { router.replace('/cashier/dashboard'); return; }
        setRequestType(data.requestType);
        setForm({
          name: data.name,
          category: data.category,
          department: data.department,
          price: data.price != null ? String(data.price) : '',
          folder: data.folder ?? '',
          serviceCharge: data.serviceCharge,
          tax1: data.tax1,
          tax2: data.tax2,
          noDiscount: data.noDiscount,
          hideReceipt: data.hideReceipt,
          printers: data.printers ? data.printers.split(';') : [],
          outlets: data.outlets ? data.outlets.split(';') : [],
          remarks: data.remarks ?? '',
        });
      } catch {
        toast.error('Failed to load request');
        router.replace('/cashier/dashboard');
      } finally {
        setFetching(false);
      }
    }
    if (id) load();
  }, [id, router]);

  useEffect(() => {
    if (form?.category) {
      const dept = getDepartmentForCategory(form.category);
      setForm((f) => f ? { ...f, department: dept } : f);
    }
  }, [form?.category]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleList(key: 'printers' | 'outlets', value: string) {
    setForm((f) => {
      if (!f) return f;
      const list = f[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [key]: next };
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    if (!form) return false;
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Item name is required';
    if (!form.category) errs.category = 'Category is required';
    if (needsPrice && !form.price) errs.price = 'Price is required';
    if (form.price && (isNaN(Number(form.price)) || Number(form.price) <= 0))
      errs.price = 'Price must be a positive number';
    if (form.printers.length === 0) errs.printers = 'Select at least one printer';
    if (form.outlets.length === 0) errs.outlets = 'Select at least one outlet';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !form) return;
    setLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category,
        department: form.department,
        price: form.price ? Number(form.price) : null,
        folder: form.folder || null,
        serviceCharge: form.serviceCharge,
        tax1: form.tax1,
        tax2: form.tax2,
        noDiscount: form.noDiscount,
        hideReceipt: form.hideReceipt,
        printers: form.printers.join(';'),
        outlets: form.outlets.join(';'),
        remarks: form.remarks || null,
      };
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Update failed');
      }
      const data = await res.json();
      setSuccessModal({ open: true, itemName: data.name });
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (fetching || !form) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <SuccessModal
        isOpen={successModal.open}
        itemName={successModal.itemName}
        title="Request Updated"
        body="Your changes have been saved and are pending review."
        submitAnotherLabel="Back to Dashboard"
        onSubmitAnother={() => { setSuccessModal({ open: false, itemName: '' }); router.push('/cashier/dashboard'); }}
        onViewRequests={() => { setSuccessModal({ open: false, itemName: '' }); router.push('/cashier/dashboard'); }}
      />

      <Link href="/cashier/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textDecoration: 'none' }}>
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Edit Request</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Request type: <strong>{requestType.replace(/_/g, ' ')}</strong>
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(184,134,11,0.06)', border: '1px solid rgba(184,134,11,0.2)', borderRadius: '6px', marginBottom: '1.5rem', maxWidth: '680px', margin: '0 auto 1.5rem' }}>
        <AlertTriangle size={15} style={{ color: '#8B6914', flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.8rem', color: '#8B6914', lineHeight: 1.5 }}>
          This request is still pending. You can make changes before it is reviewed.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Item Details */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>Item Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FieldGroup label="Item Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Chix Poppers"
                className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.name ? 'border-red-400' : 'border-u-input'}`}
              />
              {errors.name && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.name}</p>}
            </FieldGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FieldGroup label="Category">
                <Combobox
                  options={categoryOptions}
                  value={form.category}
                  onChange={(v) => set('category', v)}
                  placeholder="Select category..."
                  searchPlaceholder="Search categories..."
                />
                {errors.category && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.category}</p>}
              </FieldGroup>
              <FieldGroup label="Department" hint="Auto-filled from category">
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-u-input bg-u-cream px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200"
                />
              </FieldGroup>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {needsPrice && (
                <FieldGroup label="Price (IDR)">
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    placeholder="95000"
                    className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.price ? 'border-red-400' : 'border-u-input'}`}
                  />
                  {errors.price && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.price}</p>}
                </FieldGroup>
              )}
              <FieldGroup label="Folder / Menu Section">
                <input
                  type="text"
                  value={form.folder}
                  onChange={(e) => set('folder', e.target.value)}
                  placeholder="e.g. CINCO DE MAYO"
                  className="flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200"
                />
              </FieldGroup>
            </div>
          </div>
        </div>

        {/* Printers — grouped */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Printers</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select which kitchen/bar printers should receive this item's tickets.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {PRINTER_GROUPS.map((group) => {
              const visible = group.printers.filter((p) => availablePrinters.has(p));
              if (visible.length === 0) return null;
              return (
                <div key={group.label}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{group.label}</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem 0.5rem' }}>
                    {visible.map((p) => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <Checkbox checked={form.printers.includes(p)} onCheckedChange={() => toggleList('printers', p)} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {errors.printers && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.printers}</p>}
        </div>

        {/* Outlets */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Outlets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {outlets.map((o) => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <Checkbox checked={form.outlets.includes(o)} onCheckedChange={() => toggleList('outlets', o)} />
                {o}
              </label>
            ))}
          </div>
          {errors.outlets && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.outlets}</p>}
        </div>

        {/* POS Settings */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>POS Settings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            {(
              [
                { key: 'serviceCharge', label: 'Service Charge' },
                { key: 'tax1', label: 'Tax 1' },
                { key: 'tax2', label: 'Tax 2' },
                { key: 'noDiscount', label: 'No Discount' },
                { key: 'hideReceipt', label: 'Hide on Receipt' },
              ] as { key: keyof FormState; label: string }[]
            ).map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {label}
                <Switch checked={form[key] as boolean} onCheckedChange={(v) => set(key, v as FormState[typeof key])} />
              </label>
            ))}
          </div>
        </div>

        {/* Remarks */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <FieldGroup label="Remarks" hint="Optional additional context for the admin.">
            <textarea
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
            />
          </FieldGroup>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.5rem',
              background: loading ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)',
              color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem',
              fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/cashier/dashboard" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.625rem 1.125rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.875rem', textDecoration: 'none' }}>
            Cancel
          </Link>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
