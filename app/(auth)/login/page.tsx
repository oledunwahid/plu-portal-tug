'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if ((session.user as any).role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/cashier/dashboard');
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) setError('Invalid email or password. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '0.75rem',
            padding: '2.5rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.875rem',
                fontWeight: 600,
                color: 'var(--bg-dark)',
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                marginBottom: '0.5rem',
              }}
            >
              The Union Group
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              PLU Management Portal
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: 'var(--border)',
              margin: '0 0 1.75rem',
            }}
          />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--input-border)',
                  background: 'var(--bg-cream)',
                  padding: '0 0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-gold)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--input-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--input-border)',
                  background: 'var(--bg-cream)',
                  padding: '0 0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-gold)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--input-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(139,58,42,0.08)',
                  border: '1px solid rgba(139,58,42,0.2)',
                  color: '#7A2E1F',
                  borderRadius: '0.375rem',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.8rem',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                height: '42px',
                background: loading ? 'rgba(26,16,8,0.6)' : 'var(--bg-dark)',
                color: 'var(--accent-gold)',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                letterSpacing: '0.04em',
                transition: 'all 200ms ease',
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          Internal use only · The Union Group Jakarta
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
