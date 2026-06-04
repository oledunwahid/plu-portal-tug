'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { SuccessModal } from '@/components/SuccessModal';
import { PLUCodeSearch } from '@/components/PLUCodeSearch';
import Link from 'next/link';

function formatIDR(value: number): string {
  if (!value || value === 0) return 'Rp 0';
  return 'Rp ' + value.toLocaleString('id-ID');
}

interface ConfigCategory {
  id: string; name: string; department: string; departmentCode: number; categoryCode: number; isActive: boolean;
}
interface ConfigPrinter {
  id: string; name: string; group: string; isActive: boolean;
}

interface FormState {
  name: string;
  category: string;
  department: string;
  price: string;
  folder: string;
  barcode: string;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  salesDef: string;
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

function ConfigErrorBanner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'rgba(122,46,31,0.07)', border: '1px solid rgba(122,46,31,0.2)' }}>
      <AlertTriangle size={14} style={{ color: '#8B3A2A', flexShrink: 0 }} />
      <span style={{ fontSize: '0.8rem', color: '#8B3A2A' }}>Gagal memuat data konfigurasi. Coba muat ulang halaman.</span>
    </div>
  );
}

function ConfigSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--bg-cream)', border: '1px solid var(--border)' }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Memuat data konfigurasi…</span>
    </div>
  );
}

async function fetchWithRetry<T>(url: string): Promise<T> {
  const doFetch = async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  };
  try { return await doFetch(); }
  catch { return await doFetch(); }
}

export default function EditRequestPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormState | null>(null);
  const [requestType, setRequestType] = useState('');
  const [requestCode, setRequestCode] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successModal, setSuccessModal] = useState({ open: false, itemName: '' });

  const sessionUser = session?.user as any;
  const outletGroup = sessionUser?.outletGroup ?? '';

  const [configCategories, setConfigCategories] = useState<ConfigCategory[]>([]);
  const [configPrinters, setConfigPrinters] = useState<ConfigPrinter[]>([]);
  const [configOutlets, setConfigOutlets] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!outletGroup) return;
    setConfigLoading(true);
    setConfigError(null);
    Promise.all([
      fetchWithRetry<ConfigCategory[]>(`/api/config/categories?activeOnly=true`),
      fetchWithRetry<ConfigPrinter[]>(`/api/config/printers?group=${encodeURIComponent(outletGroup)}&activeOnly=true`),
      fetchWithRetry<{ code: string }[]>(`/api/config/outlets?group=${encodeURIComponent(outletGroup)}&activeOnly=true`),
    ])
      .then(([cats, printers, outlets]) => {
        setConfigCategories(cats);
        setConfigPrinters(printers);
        setConfigOutlets(outlets.map((o) => o.code));
      })
      .catch(() => setConfigError('Gagal memuat data konfigurasi. Coba muat ulang halaman.'))
      .finally(() => setConfigLoading(false));
  }, [outletGroup]);

  const categoryOptions = configCategories.map((c) => ({ value: c.name, label: c.name, group: c.department }));
  const printerNames = configPrinters.map((p) => p.name);

  const isRemovePLU = requestType === 'REMOVE_PLU';
  const showName = requestType === 'NEW_ITEM' || requestType === 'UPDATE_NAME';
  const showCategoryDept = requestType === 'NEW_ITEM';
  const showPrice = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRICE';
  const showFolder = requestType === 'NEW_ITEM';
  const showPrintersCard = requestType === 'NEW_ITEM' || requestType === 'UPDATE_PRINTER';
  const showOutletsCard = requestType === 'NEW_ITEM';
  const showPOSCard = requestType === 'NEW_ITEM';
  const showSalesDef = requestType === 'NEW_ITEM';
  const showItemDetailsCard = showName || showCategoryDept || showPrice || showFolder || requestType === 'UPDATE_PRICE';

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
        setRequestCode(data.code ?? null);
        setForm({
          name: data.name,
          category: data.category,
          department: data.department,
          price: data.price != null ? String(data.price) : '',
          folder: data.folder ?? '',
          barcode: data.department === 'WINE' ? (data.barcode ?? '') : '',
          serviceCharge: data.serviceCharge,
          tax1: data.tax1,
          tax2: data.tax2,
          noDiscount: data.noDiscount,
          hideReceipt: data.hideReceipt,
          salesDef: data.salesDef ?? 'SALES',
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
    if (form?.category && configCategories.length > 0) {
      const dept = configCategories.find((c) => c.name === form.category)?.department ?? '';
      if (dept) setForm((f) => f ? { ...f, department: dept, barcode: dept !== 'WINE' ? '' : f.barcode } : f);
    }
  }, [form?.category, configCategories]);

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
    if (requestType === 'NEW_ITEM') {
      if (!form.name.trim()) errs.name = 'Item name is required';
      if (!form.category) errs.category = 'Category is required';
      if (form.printers.length === 0) errs.printers = 'Select at least one printer';
      if (form.outlets.length === 0) errs.outlets = 'Select at least one outlet';
    } else if (requestType === 'UPDATE_PRICE') {
      if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) errs.price = 'Harga baru harus diisi dan lebih dari 0';
    } else if (requestType === 'UPDATE_NAME') {
      if (!form.name.trim()) errs.name = 'Item name is required';
    } else if (requestType === 'UPDATE_PRINTER') {
      if (form.printers.length === 0) errs.printers = 'Select at least one printer';
    } else if (requestType === 'REMOVE_PLU') {
      if (!form.remarks.trim()) errs.remarks = 'Alasan penghapusan harus diisi';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !form) return;
    setLoading(true);
    try {
      const body = {
        name: form.name.trim() || '',
        category: form.category,
        department: form.department,
        price: form.price !== '' ? Number(form.price) : 0,
        folder: form.folder || null,
        serviceCharge: form.serviceCharge,
        tax1: form.tax1,
        tax2: form.tax2,
        noDiscount: form.noDiscount,
        hideReceipt: form.hideReceipt,
        printers: form.printers.join(';'),
        outlets: form.outlets.join(';'),
        barcode: form.department === 'WINE' ? form.barcode || null : null,
        salesDef: form.salesDef || 'SALES',
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
      setSuccessModal({ open: true, itemName: data.name || requestCode || 'item' });
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
        {requestCode && <> &middot; Code: <span style={{ fontFamily: 'monospace', color: '#C9A84C' }}>{requestCode}</span></>}
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(184,134,11,0.06)', border: '1px solid rgba(184,134,11,0.2)', borderRadius: '6px', marginBottom: '1.5rem', maxWidth: '680px', margin: '0 auto 1.5rem' }}>
        <AlertTriangle size={15} style={{ color: '#8B6914', flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.8rem', color: '#8B6914', lineHeight: 1.5 }}>
          This request is still pending. You can make changes before it is reviewed.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* REMOVE_PLU layout */}
        {isRemovePLU && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '1.25rem' }}>Item to Remove</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {requestCode && (
                <FieldGroup label="PLU Code">
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-cream)', borderRadius: '0.375rem', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.875rem', color: '#C9A84C', fontWeight: 600 }}>
                    {requestCode}
                  </div>
                </FieldGroup>
              )}
              {form.name && (
                <FieldGroup label="Item Name">
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-cream)', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {form.name}
                  </div>
                </FieldGroup>
              )}
              {form.folder && (
                <FieldGroup label="Folder">
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-cream)', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {form.folder}
                  </div>
                </FieldGroup>
              )}
              <FieldGroup label="Alasan Penghapusan">
                <textarea
                  value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
                  placeholder="Jelaskan alasan penghapusan item ini..." rows={3}
                  className={`flex min-h-[80px] w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y ${errors.remarks ? 'border-red-400' : 'border-u-input'}`}
                />
                {errors.remarks && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.remarks}</p>}
              </FieldGroup>
            </div>
          </div>
        )}

        {/* Item Details for non-REMOVE_PLU */}
        {!isRemovePLU && showItemDetailsCard && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '1.25rem' }}>Item Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* PLU Code search for update types */}
              {requestType !== 'NEW_ITEM' && requestCode && (
                <FieldGroup label="PLU Code">
                  <PLUCodeSearch
                    value={requestCode}
                    onChange={() => {}}
                    disabled
                    placeholder="PLU code"
                  />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>PLU code cannot be changed after creation.</p>
                </FieldGroup>
              )}

              {showName && (
                <FieldGroup label="Item Name">
                  <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chix Poppers"
                    className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.name ? 'border-red-400' : 'border-u-input'}`} />
                  {errors.name && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.name}</p>}
                </FieldGroup>
              )}

              {showCategoryDept && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <FieldGroup label="Category">
                      {configLoading ? <ConfigSkeleton /> : configError ? <ConfigErrorBanner /> : (
                        <Combobox options={categoryOptions} value={form.category} onChange={(v) => set('category', v)} placeholder="Select category..." searchPlaceholder="Search categories..." />
                      )}
                      {errors.category && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.category}</p>}
                    </FieldGroup>
                    <FieldGroup label="Department" hint="Auto-filled from category">
                      <input type="text" value={form.department} onChange={(e) => set('department', e.target.value)} className="flex h-10 w-full rounded-md border border-u-input bg-u-cream px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200" />
                    </FieldGroup>
                  </div>
                  {form.department === 'WINE' && (
                    <FieldGroup label="Barcode">
                      <input type="text" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Enter barcode" className="flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200" />
                    </FieldGroup>
                  )}
                </>
              )}

              {(showPrice || showFolder) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {showPrice && (
                    <FieldGroup label="Price (IDR)">
                      <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="95000"
                        className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.price ? 'border-red-400' : 'border-u-input'}`} />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{formatIDR(Number(form.price))}</p>
                      {errors.price && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.price}</p>}
                    </FieldGroup>
                  )}
                  {showFolder && (
                    <FieldGroup label="Folder / Menu Section">
                      <input type="text" value={form.folder} onChange={(e) => set('folder', e.target.value)} placeholder="e.g. CINCO DE MAYO" className="flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200" />
                    </FieldGroup>
                  )}
                </div>
              )}

              {showSalesDef && (
                <FieldGroup label="SALES DEF">
                  <select value={form.salesDef} onChange={(e) => set('salesDef', e.target.value)} className="flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200">
                    <option value="SALES">SALES</option>
                    <option value="MODIFIER">MODIFIER</option>
                  </select>
                </FieldGroup>
              )}
            </div>
          </div>
        )}

        {/* Printers */}
        {showPrintersCard && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '0.25rem' }}>Printers</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Select which kitchen/bar printers should receive this item&apos;s tickets.</p>
            {configLoading ? <ConfigSkeleton /> : configError ? <ConfigErrorBanner /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem 0.5rem' }}>
                {printerNames.map((p) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <Checkbox checked={form.printers.includes(p)} onCheckedChange={() => toggleList('printers', p)} />
                    {p}
                  </label>
                ))}
              </div>
            )}
            {errors.printers && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.printers}</p>}
          </div>
        )}

        {/* Outlets */}
        {showOutletsCard && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '0.25rem' }}>Outlets</div>
            {configLoading ? <ConfigSkeleton /> : configError ? <ConfigErrorBanner /> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                {configOutlets.map((o) => (
                  <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <Checkbox checked={form.outlets.includes(o)} onCheckedChange={() => toggleList('outlets', o)} />
                    {o}
                  </label>
                ))}
              </div>
            )}
            {errors.outlets && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.outlets}</p>}
          </div>
        )}

        {/* POS Settings */}
        {showPOSCard && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: '1.25rem' }}>POS Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {([
                { key: 'serviceCharge', label: 'Service Charge' },
                { key: 'tax1', label: 'Tax 1' },
                { key: 'tax2', label: 'Tax 2' },
                { key: 'noDiscount', label: 'No Discount' },
                { key: 'hideReceipt', label: 'Hide on Receipt' },
              ] as { key: keyof FormState; label: string }[]).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {label}
                  <Switch checked={form[key] as boolean} onCheckedChange={(v) => set(key, v as FormState[typeof key])} />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Remarks */}
        {!isRemovePLU && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <FieldGroup label="Remarks" hint="Optional additional context for the admin.">
              <textarea value={form.remarks} onChange={(e) => set('remarks', e.target.value)} rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
              />
            </FieldGroup>
          </div>
        )}

        {isRemovePLU && <div style={{ marginBottom: '1.5rem' }} />}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.5rem', background: loading ? 'rgba(26,16,8,0.5)' : 'var(--bg-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
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
