'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { LogoBrand } from '@/components/LogoBrand';
import { ASSETS } from '@/lib/assets';

function SignedOutToast() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('signedOut') === 'true') {
      toast.success('You have been signed out.');
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);
  return null;
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      if (result?.error === 'INACTIVE_ACCOUNT') {
        setError('Your account has been deactivated. Please contact your manager.');
      } else if (result?.error) {
        setError('Incorrect email or password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Left panel */}
      <div
        style={{
          width: '100%', maxWidth: '420px', minHeight: '100vh',
          background: '#1A1008',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '3rem 2.5rem',
          position: 'relative', zIndex: 2,
          flexShrink: 0,
        }}
      >
        <LogoBrand variant="white" />

        <p
          style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            color: 'rgba(201,168,76,0.55)', fontSize: '0.9rem',
            marginBottom: '2.5rem', textAlign: 'center',
          }}
        >
          Where every moment matters.
        </p>

        <div style={{ width: '100%' }}>
          {error && (
            <div
              style={{
                background: 'rgba(122,46,31,0.06)', border: '1px solid rgba(122,46,31,0.2)',
                borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="8" cy="8" r="7" stroke="#7A2E1F" strokeWidth="1.2" />
                <path d="M8 5v4M8 11v.5" stroke="#7A2E1F" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: '0.8rem', color: '#7A2E1F', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', height: '42px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                  padding: '0 0.875rem', fontSize: '0.875rem', color: '#fff', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 200ms ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%', height: '42px', borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                    padding: '0 2.5rem 0 0.875rem', fontSize: '0.875rem', color: '#fff', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 200ms ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.5)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem', width: '100%', height: '44px',
                background: loading ? 'rgba(201,168,76,0.6)' : '#C9A84C',
                color: '#1A1008', border: 'none', borderRadius: '6px',
                fontSize: '0.875rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                letterSpacing: '0.06em', transition: 'all 200ms ease',
              }}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            Need access?{' '}
            <span style={{ color: 'rgba(201,168,76,0.5)' }}>Contact your manager.</span>
          </p>
        </div>

        <div style={{ position: 'absolute', bottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
            © {new Date().getFullYear()} PLU Management System
          </p>
          <p style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.04em' }}>
            Developed by Khaled · Supported by Fauzi
          </p>
        </div>
      </div>

      {/* Right panel — hero image */}
      <div
        className="login-hero-panel"
        style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'none' }}
      >
        <img
          src={ASSETS.LOGIN_HERO}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, #1A1008 0%, rgba(26,16,8,0.5) 40%, transparent 80%)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: '#2A1A0A', zIndex: -1 }} />
      </div>

      <Suspense>
        <SignedOutToast />
      </Suspense>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default LoginPage;
