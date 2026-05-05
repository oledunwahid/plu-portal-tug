'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut({ callbackUrl: '/login?signedOut=true', redirect: true });
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#1A1008',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)', color: '#C9A84C',
            fontSize: '1.4rem', fontWeight: 500, letterSpacing: '0.02em',
          }}
        >
          PLU Management System
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '0.5rem' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'rgba(201,168,76,0.4)',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
          Signing out...
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        marginTop: '12px', width: '100%',
        background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: '6px', color: 'rgba(201,168,76,0.85)', fontSize: '0.78rem',
        fontWeight: 600, cursor: 'pointer', padding: '9px 0',
        fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.18)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.45)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.1)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.25)';
      }}
    >
      <LogOut size={14} /> Sign Out
    </button>
  );
}
