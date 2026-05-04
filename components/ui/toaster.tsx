'use client';

import { useToastState } from './use-toast';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: { bg: 'rgba(61,90,62,0.1)', border: '#3D5A3E', text: '#2D4A2E', icon: '#3D5A3E' },
  error: { bg: 'rgba(139,58,42,0.1)', border: '#8B3A2A', text: '#7A2E1F', icon: '#8B3A2A' },
  info: { bg: 'rgba(42,61,90,0.1)', border: '#2A3D5A', text: '#1E2E45', icon: '#2A3D5A' },
};

export function Toaster() {
  const { toasts, dismiss } = useToastState();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '380px',
        width: '100%',
      }}
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        const color = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-card)',
              border: `1px solid ${color.border}`,
              boxShadow: 'var(--shadow-card-md)',
              animation: 'fade-in 250ms ease',
            }}
          >
            <Icon size={18} style={{ color: color.icon, flexShrink: 0, marginTop: '1px' }} />
            <span style={{ flex: 1, fontSize: '0.875rem', color: color.text, lineHeight: 1.4 }}>
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: color.text,
                opacity: 0.6,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
