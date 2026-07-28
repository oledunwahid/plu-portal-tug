'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Clock } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { getAccountIdentity } from '@/lib/wineBranding';

export function TopBar() {
  const { data: session } = useSession();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const user = session?.user as any;
  // Wine Cork shows its own mark + "WINE PIC"; every other account keeps "[ROLE] · [OUTLET]".
  const identity = getAccountIdentity(user);

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

      {/* Right: notifications (admin only) + user */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {user.role === 'ADMIN' && <NotificationBell />}
          {user.role === 'COST_CONTROL' && <NotificationBell variant="cost-control" />}
          {user.role === 'CASHIER' && <NotificationBell variant="cashier" />}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {identity.name}
            </div>
            {identity.subtitle && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: identity.isWinePic ? '#8B6914' : 'var(--text-secondary)',
                  lineHeight: 1.2,
                  fontWeight: identity.isWinePic ? 600 : undefined,
                  letterSpacing: identity.isWinePic ? '0.06em' : undefined,
                }}
              >
                {identity.subtitle}
              </div>
            )}
          </div>
          {identity.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.logoSrc}
              alt={identity.logoAlt ?? ''}
              style={{ height: '30px', width: 'auto', flexShrink: 0 }}
            />
          ) : (
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
              {(identity.name as string)?.charAt(0).toUpperCase() ?? 'U'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
