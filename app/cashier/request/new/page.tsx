'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getCategoriesForOutlet, getDepartmentForCategory } from '@/lib/categories';
import { PRINTERS_BY_GROUP, OUTLETS_BY_GROUP, OutletGroup } from '@/lib/outlets';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

const REQUEST_TYPES = [
  { value: 'NEW_ITEM', label: 'New Item' },
  { value: 'UPDATE_PRICE', label: 'Update Price' },
  { value: 'UPDATE_NAME', label: 'Update Name' },
  { value: 'UPDATE_PRINTER', label: 'Change Printer' },
  { value: 'UPDATE_FULL', label: 'Other Update' },
] as const;

type RequestTypeValue = (typeof REQUEST_TYPES)[number]['value'];

interface FormState {
  requestType: RequestTypeValue;
  code: string;
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

const DEFAULT_FORM: FormState = {
  requestType: 'NEW_ITEM',
  code: '',
  name: '',
  category: '',
  department: '',
  price: '',
  folder: '',
  serviceCharge: true,
  tax1: true,
  tax2: true,
  noDiscount: true,
  hideReceipt: false,
  printers: [],
  outlets: [],
  remarks: '',
};

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="label-caps">{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

export default function NewRequestPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sessionUser = session?.user as any;
  const outlet = sessionUser?.outlet ?? 'ROMSCBD';
  const outletGroup = (sessionUser?.outletGroup as OutletGroup) ?? 'IBR';

  const categories = getCategoriesForOutlet(outlet);
  const printers = PRINTERS_BY_GROUP[outletGroup] ?? [];
  const outlets = OUTLETS_BY_GROUP[outletGroup] ?? [];

  const categoryOptions = categories.map((c) => ({
    value: c.category,
    label: c.category,
    group: c.department,
  }));

  const isUpdate = form.requestType !== 'NEW_ITEM';
  const needsPrice = form.requestType === 'NEW_ITEM' || form.requestType === 'UPDATE_PRICE';

  useEffect(() => {
    if (form.category) {
      const dept = getDepartmentForCategory(form.category);
      setForm((f) => ({ ...f, department: dept }));
    }
  }, [form.category]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleList(key: 'printers' | 'outlets', value: string) {
    setForm((f) => {
      const list = f[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [key]: next };
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Item name is required';
    if (!form.category) errs.category = 'Category is required';
    if (isUpdate && !form.code.trim()) errs.code = 'PLU code is required for update requests';
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
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        requestType: form.requestType,
        code: form.code || undefined,
        name: form.name.trim(),
        category: form.category,
        department: form.department,
        price: form.price ? Number(form.price) : undefined,
        folder: form.folder || undefined,
        serviceCharge: form.serviceCharge,
        tax1: form.tax1,
        tax2: form.tax2,
        noDiscount: form.noDiscount,
        hideReceipt: form.hideReceipt,
        printers: form.printers.join(';'),
        outlets: form.outlets.join(';'),
        remarks: form.remarks || undefined,
      };
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Submission failed');
      }
      toast.success('Request submitted successfully!');
      setSubmitted(true);
      setForm(DEFAULT_FORM);
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: '1.75rem' }}>New PLU Request</h1>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(61,90,62,0.3)',
            borderRadius: '0.5rem',
            padding: '2.5rem',
            textAlign: 'center',
            maxWidth: '480px',
          }}
        >
          <CheckCircle size={40} style={{ color: '#3D5A3E', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            Request Submitted
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Your request has been sent for admin review. You can track its status in your dashboard.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => setSubmitted(false)}
              style={{
                padding: '0.5rem 1.125rem',
                background: 'var(--bg-dark)',
                color: 'var(--accent-gold)',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Submit Another
            </button>
            <button
              onClick={() => router.push('/cashier/dashboard')}
              style={{
                padding: '0.5rem 1.125rem',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>New PLU Request</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
        Submit a request to add or update a menu item in the POS system.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Request Type */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="label-caps" style={{ marginBottom: '0.75rem' }}>Request Type</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {REQUEST_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('requestType', t.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${form.requestType === t.value ? 'var(--bg-dark)' : 'var(--border)'}`,
                  background: form.requestType === t.value ? 'var(--bg-dark)' : 'transparent',
                  color: form.requestType === t.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: form.requestType === t.value ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item Details */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>Item Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isUpdate && (
              <FieldGroup label="PLU Code" hint="Existing POS code (e.g. ROM1011300000026)">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="ROM1011300000026"
                  className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.code ? 'border-red-400' : 'border-u-input'}`}
                />
                {errors.code && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.code}</p>}
              </FieldGroup>
            )}

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
                  placeholder="e.g. FOOD"
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

        {/* Printers */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Printers</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select which kitchen/bar printers should receive this item's tickets.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {printers.map((p) => (
              <label
                key={p}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                }}
              >
                <Checkbox
                  checked={form.printers.includes(p)}
                  onCheckedChange={() => toggleList('printers', p)}
                />
                {p}
              </label>
            ))}
          </div>
          {errors.printers && (
            <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.printers}</p>
          )}
        </div>

        {/* Outlets */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Outlets</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select which outlets this item applies to.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {outlets.map((o) => (
              <label
                key={o}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                }}
              >
                <Checkbox
                  checked={form.outlets.includes(o)}
                  onCheckedChange={() => toggleList('outlets', o)}
                />
                {o}
              </label>
            ))}
          </div>
          {errors.outlets && (
            <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.outlets}</p>
          )}
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
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                }}
              >
                {label}
                <Switch
                  checked={form[key] as boolean}
                  onCheckedChange={(v) => set(key, v as FormState[typeof key])}
                />
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
              placeholder="Any additional notes..."
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.5rem',
              background: loading ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)',
              color: 'var(--accent-gold)',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
          <button
            type="button"
            onClick={() => setForm(DEFAULT_FORM)}
            style={{
              padding: '0.625rem 1.125rem',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Clear Form
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
