'use client';

import { AlertTriangle, ScanBarcode } from 'lucide-react';
import type { BarcodeMismatch, PriceLevelsWarning } from '@/lib/itemMatch';

const fmtRp = (n: number) => n.toLocaleString('id-ID');

// Advisory, wine-only callouts shown beneath a matched price-change row.
// Detection only — neither value is auto-corrected.
export function WineWarnings({
  barcodeMismatch,
  priceLevels,
  requestedPrice,
}: {
  barcodeMismatch?: BarcodeMismatch;
  priceLevels?: PriceLevelsWarning;
  requestedPrice?: string;
}) {
  if (!barcodeMismatch && !priceLevels) return null;
  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {barcodeMismatch && (
        <div style={{ border: '1px solid rgba(122,46,31,0.3)', background: 'rgba(122,46,31,0.05)', borderRadius: '0.3rem', padding: '0.45rem 0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#7A2E1F', marginBottom: '0.35rem' }}>
            <ScanBarcode size={13} /> BARCODE MISMATCH
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              {barcodeMismatch.kind === 'orphan'
                ? '· barcode Quinos bukan Item No. SAP mana pun — perlu tinjauan'
                : '· barcode Quinos menunjuk ke item SAP yang berbeda — perlu tinjauan'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1px' }}>Barcode Quinos (master)</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{barcodeMismatch.quinosBarcode || '— kosong —'}</div>
            </div>
            {barcodeMismatch.kind === 'wrong-pointer' && (
              <div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1px' }}>Menunjuk ke item SAP</div>
                <div style={{ color: '#7A2E1F', fontWeight: 600 }}>
                  <span style={{ fontFamily: 'monospace' }}>{barcodeMismatch.resolvedItemNo}</span> · {barcodeMismatch.resolvedDescription}
                </div>
              </div>
            )}
            {barcodeMismatch.suggestedItemNo && (
              <div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1px' }}>Kemungkinan benar (cocok nama)</div>
                <div style={{ color: 'var(--text-primary)' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{barcodeMismatch.suggestedItemNo}</span> · {barcodeMismatch.suggestedDescription}
                  {barcodeMismatch.suggestedScore != null && <span style={{ color: 'var(--text-secondary)' }}> ({Math.round(barcodeMismatch.suggestedScore * 100)}%)</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {priceLevels && (
        <div style={{ border: '1px solid rgba(184,134,11,0.35)', background: 'rgba(184,134,11,0.06)', borderRadius: '0.3rem', padding: '0.45rem 0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#8B6914', marginBottom: '0.35rem' }}>
            <AlertTriangle size={13} /> PRICE LEVELS ACTIVE
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· update harga flat tidak mengubah override ini</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: '0.7rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '1px 0.75rem 1px 0', fontWeight: 600 }}>Outlet Type</th>
                  <th style={{ padding: '1px 0.75rem 1px 0', fontWeight: 600 }}>Outlet Group</th>
                  <th style={{ padding: '1px 0 1px 0', fontWeight: 600, textAlign: 'right' }}>Harga override</th>
                </tr>
              </thead>
              <tbody>
                {priceLevels.entries.map((e, idx) => (
                  <tr key={idx} style={{ color: e.price !== 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <td style={{ padding: '1px 0.75rem 1px 0' }}>{e.outletType || '—'}</td>
                    <td style={{ padding: '1px 0.75rem 1px 0' }}>{e.outletGroup || '—'}</td>
                    <td style={{ padding: '1px 0 1px 0', textAlign: 'right', fontWeight: e.price !== 0 ? 700 : 400 }}>
                      {e.price !== 0 ? `Rp ${fmtRp(e.price)}` : 'Rp 0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requestedPrice && requestedPrice.trim() !== '' && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Harga flat yang diminta: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Rp {fmtRp(Number(requestedPrice))}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
