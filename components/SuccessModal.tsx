'use client';

interface SuccessModalProps {
  isOpen: boolean;
  itemName: string;
  onSubmitAnother: () => void;
  onViewRequests: () => void;
  title?: string;
  body?: string;
  submitAnotherLabel?: string;
}

export function SuccessModal({
  isOpen,
  itemName,
  onSubmitAnother,
  onViewRequests,
  title = 'Request Submitted',
  body = 'Your request has been received and is pending review.',
  submitAnotherLabel = 'Submit Another',
}: SuccessModalProps) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: '12px',
          padding: '2.5rem 2rem', maxWidth: '400px', width: '100%',
          textAlign: 'center', boxShadow: '0 8px 32px rgba(26,16,8,0.22)',
        }}
      >
        <div
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)', margin: '0 auto 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#C9A84C" strokeWidth="1.5" />
            <path d="M8 14l4 4 8-8" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)', fontSize: '1.6rem',
            fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
          {body}
        </p>

        {itemName && (
          <span
            style={{
              display: 'inline-block', background: 'rgba(184,134,11,0.08)',
              color: '#8B6914', fontSize: '0.75rem', fontWeight: 600,
              padding: '3px 12px', borderRadius: '4px', marginBottom: '1.75rem',
              border: '1px solid rgba(184,134,11,0.2)',
            }}
          >
            {itemName}
          </span>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: itemName ? 0 : '1.75rem' }}>
          <button
            onClick={onSubmitAnother}
            style={{
              flex: 1, background: 'var(--bg-dark)', color: 'var(--accent-gold)',
              border: 'none', borderRadius: '4px', padding: '0.6rem',
              fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600,
              letterSpacing: '0.04em', cursor: 'pointer',
            }}
          >
            {submitAnotherLabel}
          </button>
          <button
            onClick={onViewRequests}
            style={{
              flex: 1, background: 'transparent', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: '4px', padding: '0.6rem',
              fontFamily: 'var(--font-body)', fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            View My Requests
          </button>
        </div>
      </div>
    </div>
  );
}
