'use client';

/**
 * `brandLogoSrc` is set only for the Wine Cork / Wine PIC account (see lib/wineBranding.ts). Every
 * other account keeps the global PLU Management System wordmark - the logo is additive, never a
 * global replacement.
 */
export function LogoBrand({
  variant = 'white',
  brandLogoSrc = null,
  brandLogoAlt = '',
}: {
  variant?: 'white' | 'dark';
  brandLogoSrc?: string | null;
  brandLogoAlt?: string;
}) {
  const textColor = variant === 'white' ? '#C9A84C' : '#1C1107';
  const subColor = variant === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(28,17,7,0.4)';

  return (
    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
      {brandLogoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brandLogoSrc}
          alt={brandLogoAlt}
          style={{
            display: 'block', margin: '0 auto 0.5rem', maxWidth: '132px', width: '100%',
            height: 'auto',
            // The mark is dark-on-transparent artwork; on the dark sidebar it needs lifting.
            filter: variant === 'white' ? 'brightness(0) invert(1) opacity(0.92)' : 'none',
          }}
        />
      )}
      <div
        style={{
          fontFamily: 'var(--font-display)', color: brandLogoSrc ? subColor : textColor,
          fontSize: brandLogoSrc ? '0.7rem' : '1.1rem',
          fontWeight: 500,
          letterSpacing: brandLogoSrc ? '0.12em' : '0.04em',
          textTransform: brandLogoSrc ? 'uppercase' : 'none',
        }}
      >
        PLU Management System
      </div>
    </div>
  );
}
