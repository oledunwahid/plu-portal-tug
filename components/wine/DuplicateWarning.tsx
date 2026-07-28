'use client';

import Link from 'next/link';
import { AlertTriangle, Ban, X } from 'lucide-react';
import { formatVintage } from '@/lib/wine';

export interface DuplicateMatch {
  id: string;
  wineName: string;
  vintage: number | null;
  isNonVintage: boolean;
  producerName: string | null;
  bottleSizeName: string | null;
  status: string;
  pluCode: string | null;
  barcode: string | null;
}

export interface DuplicatePayload {
  exact: { reason: string; message: string; match?: DuplicateMatch }[];
  potential: { reason: string; match: DuplicateMatch }[];
}

const REASON_LABELS: Record<string, string> = {
  PRODUCER_NAME_VINTAGE_SIZE: 'Producer + Wine Name + Vintage + Bottle Size sama',
  NAME_VINTAGE_SIZE: 'Wine Name + Vintage + Bottle Size sama',
};

function MatchRow({ match }: { match: DuplicateMatch }) {
  return (
    <div
      className="card"
      style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {match.wineName}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
          {[
            match.producerName,
            formatVintage(match.vintage, match.isNonVintage),
            match.bottleSizeName,
            match.status,
          ].filter(Boolean).join(' · ')}
        </div>
        <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#8B6914', marginTop: '0.15rem' }}>
          {match.pluCode ?? '—'} {match.barcode ? `· ${match.barcode}` : ''}
        </div>
      </div>
      <Link
        href={`/wine/list/${match.id}`}
        target="_blank"
        className="btn-secondary"
        style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', textDecoration: 'none', flexShrink: 0 }}
      >
        View Existing
      </Link>
    </div>
  );
}

/**
 * Duplicate dialog. Exact matches are blocking - there is no Continue button for them, whatever the
 * user's permissions. Potential matches offer Continue, which is what sets `acknowledgeDuplicate` on
 * the next save; the server re-checks and would still refuse an exact match.
 */
export function DuplicateWarning({
  duplicates,
  onCancel,
  onContinue,
  canOverride = true,
  busy = false,
}: {
  duplicates: DuplicatePayload;
  onCancel: () => void;
  onContinue?: () => void;
  canOverride?: boolean;
  busy?: boolean;
}) {
  const blocked = duplicates.exact.length > 0;

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }} />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: '540px', maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem',
          boxShadow: '0 12px 40px rgba(26,16,8,0.2)', zIndex: 61, padding: '1.35rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {blocked
              ? <Ban size={16} style={{ color: '#8B3A2A' }} />
              : <AlertTriangle size={16} style={{ color: '#8B6914' }} />}
            <h2 className="section-title" style={{ margin: 0, fontSize: '1rem' }}>
              {blocked ? 'Tidak dapat disimpan' : 'Potensi duplikat'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={15} />
          </button>
        </div>

        {duplicates.exact.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {duplicates.exact.map((entry, i) => (
              <div key={`${entry.reason}-${i}`} style={{ marginBottom: '0.6rem' }}>
                <p
                  style={{
                    fontSize: '0.82rem', color: '#8B3A2A', margin: '0 0 0.4rem',
                    background: 'rgba(139,58,42,0.07)', border: '1px solid rgba(139,58,42,0.2)',
                    borderRadius: '0.3rem', padding: '0.5rem 0.6rem',
                  }}
                >
                  {entry.message}
                </p>
                {entry.match && <MatchRow match={entry.match} />}
              </div>
            ))}
          </div>
        )}

        {duplicates.potential.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
              Wine berikut sudah terdaftar dengan identitas yang mirip. Vintage atau bottle size yang
              berbeda adalah produk yang berbeda - pastikan data Anda benar sebelum melanjutkan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {duplicates.potential.map((entry) => (
                <div key={entry.match.id}>
                  <div className="label-caps" style={{ marginBottom: '0.2rem', fontSize: '0.58rem' }}>
                    {REASON_LABELS[entry.reason] ?? entry.reason}
                  </div>
                  <MatchRow match={entry.match} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onCancel} className="btn-secondary">
            {blocked ? 'Tutup' : 'Cancel'}
          </button>
          {!blocked && canOverride && onContinue && (
            <button type="button" onClick={onContinue} className="btn-primary" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Continue & Save'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
