const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PENDING: {
    label: 'Pending',
    bg: 'var(--status-pending-bg)',
    color: 'var(--status-pending-text)',
    border: 'var(--status-pending-border)',
  },
  DONE: {
    label: 'Done',
    bg: 'var(--status-done-bg)',
    color: 'var(--status-done-text)',
    border: 'var(--status-done-border)',
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span
      style={{
        display: 'inline-block',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        padding: '0.2rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

const TYPE_CONFIG: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Chg Printer',
  UPDATE_FULL: 'Full Update',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'rgba(26,16,8,0.06)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        padding: '0.2rem 0.5rem',
        borderRadius: '3px',
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {TYPE_CONFIG[type] ?? type}
    </span>
  );
}
