'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Tag, Type, Printer, Trash2, RefreshCw } from 'lucide-react';
import StatCardSkeleton from '@/components/skeletons/StatCardSkeleton';

type TypeStat = { pending: number; exported?: number; done: number; total: number; lastUpdatedBy?: string | null; lastUpdatedAt?: string | null };
type StatsByType = Record<string, TypeStat>;

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatAuditDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const PLU_KEYS = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'REMOVE_PLU'] as const;

interface TypeCard {
  key: string;
  label: string;
  Icon: React.ElementType;
  href: string;
}

// Icons mirror the export page's per-type icons. Discount/Removal mirror the sidebar.
const TYPE_CARDS: TypeCard[] = [
  { key: 'NEW_ITEM', label: 'New Items', Icon: PlusCircle, href: '/admin/export?type=NEW_ITEM' },
  { key: 'UPDATE_PRICE', label: 'Update Price', Icon: Tag, href: '/admin/export?type=UPDATE_PRICE' },
  { key: 'UPDATE_NAME', label: 'Update Name', Icon: Type, href: '/admin/export?type=UPDATE_NAME' },
  { key: 'UPDATE_PRINTER', label: 'Change Printer', Icon: Printer, href: '/admin/export?type=UPDATE_PRINTER' },
  { key: 'REMOVE_PLU', label: 'Remove PLU', Icon: Trash2, href: '/admin/export?type=REMOVE_PLU' },
  { key: 'DISCOUNT', label: 'Discount', Icon: Tag, href: '/admin/discount' },
  { key: 'REMOVAL', label: 'Request Removal', Icon: Trash2, href: '/admin/removal' },
];

function StatCard({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '1.125rem 1.375rem' }}>
      <div className="label-caps" style={{ marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.875rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: accent ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function TypeCommandCard({ card, stat, onClick }: { card: TypeCard; stat: TypeStat | undefined; onClick: () => void }) {
  const pending = stat?.pending ?? 0;
  const exported = stat?.exported ?? 0;
  const done = stat?.done ?? 0;
  const hasPending = pending > 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: hasPending ? '3px solid #C9A84C' : '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-card)',
        padding: '1.25rem',
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <card.Icon size={18} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          {card.label}
        </span>
      </div>

      {/* Middle */}
      <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1, color: hasPending ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {pending}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>menunggu</div>

      {/* Bottom row — pending / exported / done */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: '#8B6914', fontWeight: 500 }}>{pending} menunggu</span>
        <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 500 }}>{exported} dieksport</span>
        <span style={{ fontSize: '0.75rem', color: '#2D4A2E', fontWeight: 500 }}>{done} selesai</span>
      </div>

      {/* Audit footer */}
      {stat?.lastUpdatedBy && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Terakhir diperbarui oleh {stat.lastUpdatedBy}
          {stat.lastUpdatedAt ? ` • ${formatAuditDateShort(stat.lastUpdatedAt)}` : ''}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [metrics, setMetrics] = useState<{ newItems: number; updatePrice: number; updateName: number; updatePrinter: number; totalDone: number } | null>(null);
  const [metricsFrom, setMetricsFrom] = useState('');
  const [metricsTo, setMetricsTo] = useState('');

  const [stats, setStats] = useState<StatsByType | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/stats/by-type');
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    async function fetchMetrics() {
      const params = new URLSearchParams();
      if (metricsFrom) params.set('from', metricsFrom);
      if (metricsTo) params.set('to', metricsTo);
      const res = await fetch(`/api/admin/metrics?${params}`);
      if (res.ok) setMetrics(await res.json());
    }
    fetchMetrics();
  }, [metricsFrom, metricsTo]);

  // Summary stat cards derived from the combined (single + batch) per-type stats.
  const summary = stats ? {
    total: PLU_KEYS.reduce((s, t) => s + (stats[t]?.total ?? 0), 0),
    pending: PLU_KEYS.reduce((s, t) => s + (stats[t]?.pending ?? 0), 0),
    done: PLU_KEYS.reduce((s, t) => s + (stats[t]?.done ?? 0), 0),
    newItems: stats.NEW_ITEM?.total ?? 0,
  } : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Pusat kendali permintaan — pilih jenis untuk memproses.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={statsLoading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: statsLoading ? 'not-allowed' : 'pointer', opacity: statsLoading ? 0.5 : 1 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI metrics (ALL-TIME STATUSES) */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="label-caps">All-Time Statuses</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <input type="date" value={metricsFrom} onChange={(e) => setMetricsFrom(e.target.value)} style={{ height: '28px', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.4rem', fontSize: '0.75rem', outline: 'none' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>–</span>
            <input type="date" value={metricsTo} onChange={(e) => setMetricsTo(e.target.value)} style={{ height: '28px', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'var(--bg-cream)', color: 'var(--text-primary)', padding: '0 0.4rem', fontSize: '0.75rem', outline: 'none' }} />
            {(metricsFrom || metricsTo) && <button onClick={() => { setMetricsFrom(''); setMetricsTo(''); }} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'New Items', value: metrics?.newItems },
            { label: 'Price Updates', value: metrics?.updatePrice },
            { label: 'Name Updates', value: metrics?.updateName },
            { label: 'Printer Updates', value: metrics?.updatePrinter },
            { label: 'Total Done', value: metrics?.totalDone, accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ textAlign: 'center', padding: '0.625rem', borderRadius: '6px', background: 'var(--bg-cream)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.375rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: accent ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1 }}>
                {value ?? '—'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      {statsLoading ? (
        <StatCardSkeleton />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
          <StatCard label="Shown" value={summary?.total ?? null} />
          <StatCard label="Pending" value={summary?.pending ?? null} accent={(summary?.pending ?? 0) > 0} />
          <StatCard label="Done" value={summary?.done ?? null} />
          <StatCard label="New Items" value={summary?.newItems ?? null} />
        </div>
      )}

      {/* Request type command center */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.875rem' }}>
        Antrian Permintaan
      </h2>

      {statsLoading ? (
        <div className="cmd-grid">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <div className="skeleton" style={{ height: '18px', width: '60%', marginBottom: '0.875rem' }} />
              <div className="skeleton" style={{ height: '40px', width: '50px', marginBottom: '0.375rem' }} />
              <div className="skeleton" style={{ height: '10px', width: '70px', marginBottom: '0.875rem' }} />
              <div className="skeleton" style={{ height: '10px', width: '90%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="cmd-grid">
          {TYPE_CARDS.map((card) => (
            <TypeCommandCard
              key={card.key}
              card={card}
              stat={stats?.[card.key]}
              onClick={() => router.push(card.href)}
            />
          ))}
        </div>
      )}

      <style>{`
        .cmd-grid { display: grid; gap: 0.875rem; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 768px) { .cmd-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1100px) { .cmd-grid { grid-template-columns: repeat(4, 1fr); } }
      `}</style>
    </div>
  );
}
