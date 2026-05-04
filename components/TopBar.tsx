'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Clock } from 'lucide-react';

export function TopBar() {
  const { data: session } = useSession();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const user = session?.user as any;

  const timeStr = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const dateStr = now
    ? now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        padding: '0 2.5rem',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Left: clock + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={13} style={{ color: 'var(--text-secondary)' }} />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {timeStr}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{dateStr}</span>
      </div>

      {/* Right: user */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {user.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
              {user.role}{user.outlet ? ` · ${user.outlet}` : ''}
            </div>
          </div>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--bg-dark)',
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(user.name as string)?.charAt(0).toUpperCase() ?? 'U'}
          </div>
        </div>
      )}
    </div>
  );
}
