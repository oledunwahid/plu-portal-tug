'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { OUTLETS_BY_GROUP, OutletGroup } from '@/lib/outlets';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { SuccessModal } from '@/components/SuccessModal';
import Link from 'next/link';

function formatIDR(value: string): string {
  const n = parseInt(value.replace(/\D/g, ''), 10);
  if (!n) return '';
  return n.toLocaleString('id-ID');
}

function FieldGroup({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="label-caps">{label}{required && <span style={{ color: '#7A2E1F', marginLeft: '0.2rem' }}>*</span>}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

interface FormState {
  buttonName: string;
  discountType: 'FIXED_AMOUNT' | 'PERCENTAGE' | '';
  discountValue: string;
  applicableTo: string;
  conditions: string;
  remarks: string;
  outlets: string[];
}

export default function EditDiscountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successModal, setSuccessModal] = useState({ open: false, name: '' });
  const [originalOutlets, setOriginalOutlets] = useState<string[]>([]);

  const sessionUser = session?.user as any;
  const outletGroup = (sessionUser?.outletGroup as OutletGroup) ?? 'IBR';
  const outlets = OUTLETS_BY_GROUP[outletGroup] ?? [];

  useEffect(() => {
    if (!id) return;
    fetch(`/api/discount/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.status === 'DONE') {
          toast.error('This request has already been processed');
          router.replace('/cashier/dashboard');
          return;
        }
        const outletArr = data.outlets ? data.outlets.split(';').filter(Boolean) : [];
        setOriginalOutlets(outletArr);
        setForm({
          buttonName: data.buttonName,
          discountType: data.discountType as any,
          discountValue: String(data.discountValue),
          applicableTo: data.applicableTo,
          conditions: data.conditions ?? '',
          remarks: data.remarks ?? '',
          outlets: outletArr,
        });
        setFetching(false);
      })
      .catch(() => {
        toast.error('Failed to load request');
        router.replace('/cashier/dashboard');
      });
  }, [id, router]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleOutlet(o: string) {
    setForm((f) => {
      if (!f) return f;
      const next = f.outlets.includes(o) ? f.outlets.filter((x) => x !== o) : [...f.outlets, o];
      return { ...f, outlets: next };
    });
    setErrors((e) => ({ ...e, outlets: undefined }));
  }

  function validate(): boolean {
    if (!form) return false;
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.buttonName.trim()) errs.buttonName = 'Button name is required';
    if (!form.discountType) errs.discountType = 'Discount type is required';
    if (!form.discountValue || Number(form.discountValue.replace(/\D/g, '')) <= 0) errs.discountValue = 'Discount value must be greater than 0';
    if (!form.applicableTo.trim()) errs.applicableTo = 'This field is required';
    if (form.outlets.length === 0) errs.outlets = 'Select at least one outlet';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !form) return;
    setLoading(true);
    try {
      const rawValue = form.discountType === 'FIXED_AMOUNT'
        ? Number(form.discountValue.replace(/\D/g, ''))
        : Number(form.discountValue);

      const res = await fetch(`/api/discount/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buttonName: form.buttonName.trim(),
          discountType: form.discountType,
          discountValue: rawValue,
          applicableTo: form.applicableTo.trim(),
          conditions: form.conditions || null,
          remarks: form.remarks || null,
          outlets: form.outlets,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Update failed');
      }
      setSuccessModal({ open: true, name: form.buttonName.trim() });
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

  const isFixed = form.discountType === 'FIXED_AMOUNT';
  const isPercent = form.discountType === 'PERCENTAGE';

  return (
    <div>
      <SuccessModal
        isOpen={successModal.open}
        itemName={successModal.name}
        title="Request Updated"
        body="Your changes have been saved and are pending review."
        submitAnotherLabel="Back to Dashboard"
        onSubmitAnother={() => { setSuccessModal({ open: false, name: '' }); router.push('/cashier/dashboard'); }}
        onViewRequests={() => { setSuccessModal({ open: false, name: '' }); router.push('/cashier/dashboard'); }}
      />

      <Link href="/cashier/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textDecoration: 'none' }}>
        <ChevronLeft size={14} /> Back to Dashboard
      </Link>

      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Edit Discount Request</h1>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(184,134,11,0.06)', border: '1px solid rgba(184,134,11,0.2)', borderRadius: '6px', marginBottom: '1.5rem', maxWidth: '680px', margin: '0 auto 1.5rem' }}>
        <AlertTriangle size={15} style={{ color: '#8B6914', flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.8rem', color: '#8B6914', lineHeight: 1.5 }}>
          This request is still pending. You can make changes before it is reviewed.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>Discount Button Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <FieldGroup label="Button Name" required>
              <input
                type="text"
                value={form.buttonName}
                onChange={(e) => set('buttonName', e.target.value)}
                className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.buttonName ? 'border-red-400' : 'border-u-input'}`}
              />
              {errors.buttonName && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.buttonName}</p>}
            </FieldGroup>

            <FieldGroup label="Discount Type" required>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                {[
                  { value: 'FIXED_AMOUNT', label: 'Nominal Tetap' },
                  { value: 'PERCENTAGE', label: 'Persentase' },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { set('discountType', t.value as any); set('discountValue', ''); }}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '0.375rem',
                      border: `1px solid ${form.discountType === t.value ? 'var(--bg-dark)' : 'var(--border)'}`,
                      background: form.discountType === t.value ? 'var(--bg-dark)' : 'transparent',
                      color: form.discountType === t.value ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      fontSize: '0.8rem', fontWeight: form.discountType === t.value ? 500 : 400, cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {errors.discountType && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.discountType}</p>}
            </FieldGroup>

            <FieldGroup label="Discount Value" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {isFixed && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Rp</span>}
                <input
                  type="text"
                  inputMode="numeric"
                  value={isFixed ? formatIDR(form.discountValue) : form.discountValue}
                  onChange={(e) => {
                    const raw = isFixed ? e.target.value.replace(/\D/g, '') : e.target.value.replace(/[^0-9.]/g, '');
                    set('discountValue', raw);
                  }}
                  className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.discountValue ? 'border-red-400' : 'border-u-input'}`}
                />
                {isPercent && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flexShrink: 0 }}>%</span>}
              </div>
              {errors.discountValue && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.discountValue}</p>}
            </FieldGroup>

            <FieldGroup label="Applicable To" required>
              <input
                type="text"
                value={form.applicableTo}
                onChange={(e) => set('applicableTo', e.target.value)}
                className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.applicableTo ? 'border-red-400' : 'border-u-input'}`}
              />
              {errors.applicableTo && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.applicableTo}</p>}
            </FieldGroup>

            <FieldGroup label="Conditions">
              <textarea
                value={form.conditions}
                onChange={(e) => set('conditions', e.target.value)}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
              />
            </FieldGroup>

            <FieldGroup label="Remarks">
              <textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
              />
            </FieldGroup>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Outlets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginTop: '1rem' }}>
            {outlets.map((o) => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <Checkbox checked={form.outlets.includes(o)} onCheckedChange={() => toggleOutlet(o)} />
                {o}
              </label>
            ))}
          </div>
          {errors.outlets && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', marginTop: '0.5rem' }}>{errors.outlets}</p>}
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
            {loading ? 'Saving...' : 'Save Changes'}
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
