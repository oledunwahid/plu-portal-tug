'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { OUTLETS_BY_GROUP, OutletGroup } from '@/lib/outlets';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SuccessModal } from '@/components/SuccessModal';

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

const DEFAULT_FORM: FormState = {
  buttonName: '',
  discountType: '',
  discountValue: '',
  applicableTo: '',
  conditions: '',
  remarks: '',
  outlets: [],
};

export default function NewDiscountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, name: '' });

  const sessionUser = session?.user as any;
  const outletGroup = (sessionUser?.outletGroup as OutletGroup) ?? 'IBR';
  const baseOutlets = OUTLETS_BY_GROUP[outletGroup] ?? [];
  const outlets = outletGroup === 'CNS' && !baseOutlets.includes('IND1')
    ? [...baseOutlets, 'IND1']
    : baseOutlets;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleOutlet(o: string) {
    setForm((f) => {
      const next = f.outlets.includes(o) ? f.outlets.filter((x) => x !== o) : [...f.outlets, o];
      return { ...f, outlets: next };
    });
    setErrors((e) => ({ ...e, outlets: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.buttonName.trim()) errs.buttonName = 'Button name is required';
    if (!form.discountType) errs.discountType = 'Discount type is required';
    if (!form.discountValue || Number(form.discountValue.replace(/\D/g, '')) <= 0) errs.discountValue = 'Discount value must be greater than 0';
    if (!form.applicableTo.trim()) errs.applicableTo = 'Applicable To is required';
    if (form.outlets.length === 0) errs.outlets = 'Select at least one outlet';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const rawValue = form.discountType === 'FIXED_AMOUNT'
        ? Number(form.discountValue.replace(/\D/g, ''))
        : Number(form.discountValue);

      const res = await fetch('/api/discount', {
        method: 'POST',
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
        throw new Error(data.error ?? 'Submission failed');
      }
      setSuccessModal({ open: true, name: form.buttonName.trim() });
      setForm(DEFAULT_FORM);
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const isFixed = form.discountType === 'FIXED_AMOUNT';
  const isPercent = form.discountType === 'PERCENTAGE';

  return (
    <div>
      <SuccessModal
        isOpen={successModal.open}
        itemName={successModal.name}
        title="Discount Request Submitted"
        body="Your discount button request has been received and is pending review."
        submitAnotherLabel="Submit Another"
        onSubmitAnother={() => setSuccessModal({ open: false, name: '' })}
        onViewRequests={() => { setSuccessModal({ open: false, name: '' }); router.push('/cashier/dashboard'); }}
      />

      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>New Discount Request</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
        Request a new discount button to be created in the POS system.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Button Details */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginBottom: '1.25rem' }}>Discount Button Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <FieldGroup label="Button Name" required hint='Name that will appear on the POS button. Example: "OCBC 2jt", "Birthday Discount 10%"'>
              <input
                type="text"
                value={form.buttonName}
                onChange={(e) => set('buttonName', e.target.value)}
                placeholder='e.g. OCBC 2jt'
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

            {form.discountType && (
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
                    placeholder={isFixed ? '0' : '0'}
                    className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.discountValue ? 'border-red-400' : 'border-u-input'}`}
                  />
                  {isPercent && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flexShrink: 0 }}>%</span>}
                </div>
                {errors.discountValue && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.discountValue}</p>}
              </FieldGroup>
            )}

            <FieldGroup label="Applicable To" required hint='Describe what items the discount applies to. Example: "Semua item kecuali promo", "Food only"'>
              <input
                type="text"
                value={form.applicableTo}
                onChange={(e) => set('applicableTo', e.target.value)}
                placeholder="e.g. Semua item kecuali promo"
                className={`flex h-10 w-full rounded-md border bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 ${errors.applicableTo ? 'border-red-400' : 'border-u-input'}`}
              />
              {errors.applicableTo && <p style={{ fontSize: '0.75rem', color: '#8B3A2A' }}>{errors.applicableTo}</p>}
            </FieldGroup>

            <FieldGroup label="Conditions" hint='Special conditions. Example: "Hanya untuk kartu kredit OCBC Voyage"'>
              <textarea
                value={form.conditions}
                onChange={(e) => set('conditions', e.target.value)}
                placeholder="Any special conditions..."
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
              />
            </FieldGroup>

            <FieldGroup label="Remarks" hint="Additional notes for the admin.">
              <textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60 focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold transition-all duration-200 resize-y"
              />
            </FieldGroup>
          </div>
        </div>

        {/* Outlets */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="section-title" style={{ marginBottom: '0.25rem' }}>Outlets</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select which outlets this discount button applies to.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
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
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          <button
            type="button"
            onClick={() => setForm(DEFAULT_FORM)}
            style={{
              padding: '0.625rem 1.125rem', background: 'transparent',
              color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer',
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
