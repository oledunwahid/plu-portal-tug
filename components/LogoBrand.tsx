'use client';

export function LogoBrand({ variant = 'white' }: { variant?: 'white' | 'dark' }) {
  const textColor = variant === 'white' ? '#C9A84C' : '#1C1107';
  const subColor = variant === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(28,17,7,0.4)';

  return (
    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)', color: textColor,
          fontSize: '1.1rem', fontWeight: 500, letterSpacing: '0.04em',
        }}
      >
        PLU Management System
      </div>
    </div>
  );
}
