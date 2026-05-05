'use client';

import { useState } from 'react';
import { ASSETS } from '@/lib/assets';

export function LogoBrand({ variant = 'white' }: { variant?: 'white' | 'dark' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = variant === 'white' ? ASSETS.LOGO_WHITE : ASSETS.LOGO_DARK;
  const textColor = variant === 'white' ? '#C9A84C' : '#1C1107';
  const subColor = variant === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(28,17,7,0.4)';

  if (imgFailed) {
    return (
      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)', color: textColor,
            fontSize: '1.5rem', fontWeight: 500, letterSpacing: '0.04em',
          }}
        >
          The Union Group
        </div>
        <div
          style={{
            fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: subColor, marginTop: '3px',
          }}
        >
          PLU Portal
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="The Union Group"
      onError={() => setImgFailed(true)}
      style={{ height: '48px', width: 'auto', objectFit: 'contain', marginBottom: '0.75rem' }}
    />
  );
}
