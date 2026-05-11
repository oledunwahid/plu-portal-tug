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

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <div className="lp-root">
      {/* ── Hero background — always present ── */}
      <div className="lp-bg">
        <img
          src={ASSETS.LOGIN_HERO}
          alt=""
          aria-hidden="true"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="lp-bg-overlay" />
      </div>

      {/* ── Page layout ── */}
      <div className="lp-layout">
        {/* Card: glass on mobile/tablet → solid panel on desktop */}
        <div className="lp-card">
          <div className="lp-card-body">

            {/* Brand */}
            <div className="lp-brand">
              <LogoBrand variant="white" />
              <p className="lp-tagline">Where every moment matters.</p>
            </div>

            {/* Divider */}
            <div className="lp-divider" />

            {/* Error */}
            {error && (
              <div className="lp-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="8" cy="8" r="7" stroke="#D4826A" strokeWidth="1.2" />
                  <path d="M8 5v4M8 11v.5" stroke="#D4826A" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="lp-label" htmlFor="lp-email">Email</label>
                <input
                  id="lp-email"
                  className="lp-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="lp-label" htmlFor="lp-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="lp-password"
                    className="lp-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="lp-eye"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="lp-btn"
                style={{ marginTop: '0.5rem' }}
              >
                {loading && (
                  <Loader2 size={15} style={{ animation: 'lp-spin 1s linear infinite', flexShrink: 0 }} />
                )}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="lp-hint">
              Need access?{' '}
              <span>Contact your manager.</span>
            </p>
          </div>

          {/* Footer */}
          <div className="lp-footer">
            <p>© {new Date().getFullYear()} PLU Management System</p>
            <p>Developed by Khaled · Supported by Fauzi</p>
          </div>
        </div>
      </div>

      <Suspense>
        <SignedOutToast />
      </Suspense>

      <style>{`
        /* ── Root ───────────────────────────────────────────────────── */
        .lp-root {
          position: relative;
          min-height: 100dvh;
        }

        /* ── Background ──────────────────────────────────────────────── */
        .lp-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: #120700;
        }
        .lp-bg img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: center;
        }
        .lp-bg-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            150deg,
            rgba(10, 5, 0, 0.70) 0%,
            rgba(20, 11, 2, 0.52) 55%,
            rgba(12, 6, 1, 0.62) 100%
          );
        }

        /* ── Layout ──────────────────────────────────────────────────── */
        .lp-layout {
          position: relative;
          z-index: 1;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.25rem;
        }

        /* ── Card — glass on mobile/tablet ───────────────────────────── */
        .lp-card {
          width: 100%;
          max-width: 400px;
          background: rgba(14, 7, 1, 0.72);
          backdrop-filter: blur(32px) saturate(1.6);
          -webkit-backdrop-filter: blur(32px) saturate(1.6);
          border: 1px solid rgba(201, 168, 76, 0.16);
          border-radius: 20px;
          padding: 2.25rem 1.875rem 1.875rem;
          box-shadow:
            0 32px 96px rgba(0, 0, 0, 0.70),
            0 2px 0 rgba(255, 255, 255, 0.03) inset,
            0 -1px 0 rgba(0, 0, 0, 0.3) inset;
          position: relative;
          overflow: hidden;
        }
        /* Top-left glass sheen */
        .lp-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(201, 168, 76, 0.35) 35%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(201, 168, 76, 0.25) 65%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }

        /* ── Card body ───────────────────────────────────────────────── */
        .lp-card-body { position: relative; z-index: 1; }

        /* ── Brand ───────────────────────────────────────────────────── */
        .lp-brand { text-align: center; margin-bottom: 0.25rem; }
        .lp-tagline {
          font-family: var(--font-display);
          font-style: italic;
          color: rgba(201, 168, 76, 0.48);
          font-size: 0.875rem;
          margin: 0.25rem 0 0;
          letter-spacing: 0.01em;
        }

        /* ── Divider ─────────────────────────────────────────────────── */
        .lp-divider {
          height: 1px;
          margin: 1.5rem 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(201, 168, 76, 0.22) 25%,
            rgba(201, 168, 76, 0.45) 50%,
            rgba(201, 168, 76, 0.22) 75%,
            transparent 100%
          );
        }

        /* ── Error ───────────────────────────────────────────────────── */
        .lp-error {
          background: rgba(90, 22, 10, 0.28);
          border: 1px solid rgba(180, 80, 55, 0.22);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          backdrop-filter: blur(6px);
        }
        .lp-error span {
          font-size: 0.8rem;
          color: #E8937C;
          line-height: 1.5;
        }

        /* ── Label ───────────────────────────────────────────────────── */
        .lp-label {
          display: block;
          font-size: 0.67rem;
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.34);
          margin-bottom: 0.375rem;
        }

        /* ── Input ───────────────────────────────────────────────────── */
        .lp-input {
          width: 100%;
          height: 44px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.055);
          padding: 0 0.875rem;
          font-size: 0.875rem;
          color: #fff;
          outline: none;
          box-sizing: border-box;
          transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
          font-family: var(--font-body);
        }
        .lp-input::placeholder { color: rgba(255, 255, 255, 0.17); }
        .lp-input:focus {
          border-color: rgba(201, 168, 76, 0.52);
          background: rgba(255, 255, 255, 0.09);
          box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.09);
        }

        /* ── Eye toggle ──────────────────────────────────────────────── */
        .lp-eye {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.26);
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 150ms ease;
        }
        .lp-eye:hover { color: rgba(255, 255, 255, 0.55); }

        /* ── Submit button ───────────────────────────────────────────── */
        .lp-btn {
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, #D6AB42 0%, #C9A84C 55%, #BA922C 100%);
          color: #160C01;
          border: none;
          border-radius: 9px;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          letter-spacing: 0.055em;
          font-family: var(--font-body);
          transition: all 220ms ease;
          box-shadow:
            0 2px 18px rgba(180, 140, 40, 0.32),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
        }
        .lp-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #E2B845 0%, #D4A940 55%, #C49A30 100%);
          box-shadow:
            0 6px 28px rgba(180, 140, 40, 0.48),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
          transform: translateY(-1px);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0px);
          box-shadow:
            0 2px 10px rgba(180, 140, 40, 0.25),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
        }
        .lp-btn:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          transform: none;
        }

        /* ── Hint ────────────────────────────────────────────────────── */
        .lp-hint {
          margin-top: 1.125rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.2);
          text-align: center;
          line-height: 1.4;
        }
        .lp-hint span { color: rgba(201, 168, 76, 0.46); }

        /* ── Footer ──────────────────────────────────────────────────── */
        .lp-footer {
          text-align: center;
          margin-top: 1.625rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.055);
        }
        .lp-footer p {
          margin: 0 0 0.15rem;
          font-size: 0.615rem;
          color: rgba(255, 255, 255, 0.15);
          letter-spacing: 0.05em;
        }

        /* ── Tablet — slightly more breathing room ───────────────────── */
        @media (min-width: 520px) {
          .lp-card {
            max-width: 420px;
            padding: 2.75rem 2.375rem 2.25rem;
            border-radius: 22px;
          }
          .lp-card::before { border-radius: 22px 22px 0 0; }
        }

        /* ── Desktop — solid warm side panel ────────────────────────── */
        @media (min-width: 1024px) {
          .lp-layout {
            justify-content: flex-start;
            align-items: stretch;
            padding: 0;
          }
          .lp-card {
            width: 448px;
            max-width: none;
            flex-shrink: 0;
            min-height: 100dvh;
            border-radius: 0;
            border: none;
            border-right: 1px solid rgba(201, 168, 76, 0.09);
            background: #1A1008;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            box-shadow: 6px 0 48px rgba(0, 0, 0, 0.45);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 2.75rem;
            overflow-y: auto;
          }
          .lp-card::before {
            display: none;
          }
          .lp-card-body {
            width: 100%;
            max-width: 360px;
          }
          .lp-footer {
            position: absolute;
            bottom: 1.75rem;
            left: 0; right: 0;
            margin: 0;
            padding: 0;
            border-top: none;
          }
          .lp-tagline { font-size: 0.9rem; }
          .lp-divider { margin: 1.75rem 0; }
        }

        /* ── Very small screens ──────────────────────────────────────── */
        @media (max-width: 380px) {
          .lp-layout { padding: 1.25rem 1rem; }
          .lp-card {
            padding: 1.875rem 1.375rem 1.625rem;
            border-radius: 16px;
          }
          .lp-card::before { border-radius: 16px 16px 0 0; }
        }

        /* ── Spin animation ──────────────────────────────────────────── */
        @keyframes lp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
