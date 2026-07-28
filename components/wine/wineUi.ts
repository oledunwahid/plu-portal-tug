/**
 * Shared inline-style tokens for the Wine List screens. The portal styles with inline objects plus a
 * handful of global classes (card / page-title / label-caps / btn-*), so these constants keep the wine
 * pages visually identical to the rest of the app instead of introducing a second styling approach.
 */

export const WINE_FIELD_STYLE: React.CSSProperties = {
  height: '34px',
  borderRadius: '0.375rem',
  border: '1px solid var(--input-border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '0 0.625rem',
  fontSize: '0.8rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-body)',
};

export const WINE_SELECT_STYLE: React.CSSProperties = {
  ...WINE_FIELD_STYLE,
  cursor: 'pointer',
  width: 'auto',
};

export const WINE_TEXTAREA_STYLE: React.CSSProperties = {
  ...WINE_FIELD_STYLE,
  height: 'auto',
  minHeight: '72px',
  padding: '0.5rem 0.625rem',
  resize: 'vertical',
  lineHeight: 1.5,
};

export const CARD_SECTION_STYLE: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
};

export function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '—';
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/[;,]/).map((v) => v.trim()).filter(Boolean);
}
