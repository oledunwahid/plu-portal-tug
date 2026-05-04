'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { ALL_OUTLETS } from '@/lib/outlets';

interface FormState {
  email: string;
  password: string;
  name: string;
  role: 'CASHIER' | 'ADMIN';
  outlet: string;
}

function FieldGroup({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label className="label-caps">{label}</label>
      {children}
      {error && <p style={{ fontSize: '0.75rem', color: '#8B3A2A', margin: 0 }}>{error}</p>}
    </div>
  );
}

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ email: '', password: '', name: '', role: 'CASHIER', outlet: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'At least 6 characters';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.outlet) errs.outlet = 'Outlet is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create user');
      toast.success(`User ${form.name} created`);
      router.push('/admin/users');
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/admin/users" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        <ChevronLeft size={14} />
        Back to Users
      </Link>

      <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Add User</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
        Create a new cashier or admin account.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '520px' }}>
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FieldGroup label="Full Name" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Cashier UTP"
                className="field-input"
              />
            </FieldGroup>

            <FieldGroup label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="cashier@uniongroup.com"
                className="field-input"
              />
            </FieldGroup>

            <FieldGroup label="Password" error={errors.password}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Min 6 characters"
                  className="field-input"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FieldGroup>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FieldGroup label="Role" error={errors.role}>
                <select
                  value={form.role}
                  onChange={(e) => set('role', e.target.value as FormState['role'])}
                  style={{ height: '40px', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--bg-card)', fontSize: '0.875rem', padding: '0 0.75rem', outline: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </FieldGroup>

              <FieldGroup label="Outlet" error={errors.outlet}>
                <select
                  value={form.outlet}
                  onChange={(e) => set('outlet', e.target.value)}
                  style={{ height: '40px', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--bg-card)', fontSize: '0.875rem', padding: '0 0.75rem', outline: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="">Select outlet…</option>
                  {ALL_OUTLETS.sort().map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </FieldGroup>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Creating…' : 'Create User'}
          </button>
          <Link href="/admin/users" className="btn-secondary">Cancel</Link>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
