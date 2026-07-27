'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Tag, Type, Printer, Trash2, RefreshCw, Layers, Percent } from 'lucide-react';
import StatCardSkeleton from '@/components/skeletons/StatCardSkeleton';
import {
  PLU_REQUEST_TYPES, TYPE_LABELS, SOURCE_LABELS, STATUS_COLORS, EMPTY_TYPE_STAT,
  buildStatsQuery,
  type PLURequestType, type RequestStatsSource, type StatsSummaryResponse, type TypeStat,
} from '@/lib/requestStats';

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatAuditDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const TYPE_ICONS: Record<PLURequestType, React.ElementType> = {
  NEW_ITEM: PlusCircle,
  UPDATE_PRICE: Tag,
  UPDATE_NAME: Type,
  UPDATE_PRINTER: Printer,
  REMOVE_PLU: Trash2,
};

const FALLBACK_GROUPS = ['UNION', 'CNS', 'FRENCH', 'IBR', 'IND'];

const CONTROL_STYLE: React.CSSProperties = {
  height: '32px', borderRadius: '0.375rem', border: '1px solid var(--input-border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 0.5rem',
  fontSize: '0.78rem', outline: 'none',
};

function segStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.75rem', borderRadius: '3px',
    border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border)'}`,
    background: active ? 'rgba(201,168,76,0.10)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: '0.775rem', fontWeight: active ? 600 : 400, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  };
}

/** A pending-queue card: one big "waiting to process" number, with the rest of the lifecycle small. */
function PendingCard({
  type, stat, audit, onClick,
}: {
  type: PLURequestType;
  stat: TypeStat;
  audit?: { by: string; at: string } | null;
  onClick: () => void;
}) {
  const Icon = TYPE_ICONS[type];
  const hasPending = stat.pending > 0;
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: hasPending ? `3px solid ${STATUS_COLORS.PENDING}` : '3px solid var(--border)',
        borderRadius: '8px', boxShadow: 'var(--shadow-card)', padding: '1.125rem',
        cursor: 'pointer', transition: 'box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <Icon size={17} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
          {TYPE_LABELS[type]}
        </span>
      </div>

      <div style={{ fontSize: '2.25rem', fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1, color: hasPending ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {stat.pending}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
        menunggu proses
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
        <span style={{ color: STATUS_COLORS.EXPORTED }}>{stat.exported} diekspor</span>
        <span style={{ color: STATUS_COLORS.DONE }}>{stat.done} selesai</span>
        <span style={{ color: 'var(--text-secondary)' }}>{stat.total} total</span>
      </div>

      {stat.costControl > 0 && (
        <div style={{ fontSize: '0.68rem', color: '#7A2E1F', marginTop: '0.4rem' }}>
          + {stat.costControl} menunggu cost control
        </div>
      )}

      {audit?.by && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Terakhir diperbarui oleh {audit.by}
          {audit.at ? ` • ${formatAuditDateShort(audit.at)}` : ''}
        </div>
      )}
    </div>
  );
}

/** A lifecycle tile - one stage of the pipeline for the whole (filtered) scope. */
function LifecycleTile({ label, sub, value, color, accent }: { label: string; sub: string; value: number | null; color?: string; accent?: boolean }) {
  return (
    <div style={{ padding: '0.875rem', borderRadius: '6px', background: 'var(--bg-cream)', border: `1px solid ${accent ? 'var(--accent-gold)' : 'var(--border)'}` }}>
      <div style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1, color: color ?? 'var(--text-primary)' }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '0.35rem', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{sub}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  // Scope of the pending / lifecycle sections. The All-Time section below deliberately ignores it.
  const [source, setSource] = useState<RequestStatsSource>('all');
  const [group, setGroup] = useState('ALL');
  const [outletGroups, setOutletGroups] = useState<string[]>(FALLBACK_GROUPS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [scoped, setScoped] = useState<StatsSummaryResponse | null>(null);
  const [allTime, setAllTime] = useState<StatsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // no-store: never let a stale (e.g. all-zero cold-start) response get cached and misread as
      // real counts. force-dynamic on the route keeps the server side fresh too.
      const [scopedRes, allTimeRes] = await Promise.all([
        fetch(`/api/admin/stats/summary?${buildStatsQuery({ source, group, from, to, withAudit: true })}`, { cache: 'no-store' }),
        // All-Time Summary is unfiltered by design - same endpoint, no scope, so its numbers are
        // computed exactly like the pending ones and can never contradict them.
        fetch(`/api/admin/stats/summary?${buildStatsQuery({ source: 'all' })}`, { cache: 'no-store' }),
      ]);
      if (!scopedRes.ok || !allTimeRes.ok) throw new Error();
      setScoped(await scopedRes.json());
      setAllTime(await allTimeRes.json());
      setError(false);
    } catch {
      // Surface the failure instead of silently falling back to 0 on every card - an all-zero
      // dashboard should mean "no pending work", not "the request failed".
      setScoped(null);
      setAllTime(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [source, group, from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    fetch('/api/config/outlets?activeOnly=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { group: string }[] | null) => {
        if (!data) return;
        const groups = Array.from(new Set(data.map((o) => o.group))).sort();
        if (groups.length > 0) setOutletGroups(groups);
      })
      .catch(() => { });
  }, []);

  const statOf = (t: PLURequestType): TypeStat => scoped?.byType?.[t] ?? EMPTY_TYPE_STAT;
  const summary = scoped?.summary ?? null;
  const hasFilter = group !== 'ALL' || !!from || !!to;

  // Clicking a pending card lands the admin on the matching Export queue, already filtered.
  function openQueue(type: PLURequestType) {
    const params = new URLSearchParams({ type, status: 'PENDING' });
    // 'all' has no Export equivalent (a mixed selection can't be exported) - default to Single.
    params.set('source', source === 'batch' ? 'BATCH' : 'SINGLE');
    if (group !== 'ALL') params.set('group', group);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/admin/export?${params}`);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Pusat kendali permintaan - pilih jenis untuk memproses.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Scope bar - source + group + date. Applies to Pending and Processing Status below. */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Sumber:</span>
        {(['all', 'single', 'batch'] as RequestStatsSource[]).map((s) => (
          <button key={s} onClick={() => setSource(s)} style={segStyle(source === s)}>
            {s === 'batch' && <Layers size={11} />}
            {s === 'all' ? 'Semua' : s === 'single' ? 'Single Items' : 'Batch Items'}
          </button>
        ))}
        <span style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 0.25rem' }} />
        <select value={group} onChange={(e) => setGroup(e.target.value)} style={{ ...CONTROL_STYLE, cursor: 'pointer' }}>
          <option value="ALL">All Groups</option>
          {outletGroups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={CONTROL_STYLE} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={CONTROL_STYLE} />
        </div>
        {hasFilter && (
          <button onClick={() => { setGroup('ALL'); setFrom(''); setTo(''); }} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear
          </button>
        )}
      </div>

      {/* What exactly the numbers below are counting. */}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Showing: <strong style={{ color: 'var(--text-primary)' }}>{SOURCE_LABELS[source]}</strong>
        {group !== 'ALL' && <> · Group <strong style={{ color: 'var(--text-primary)' }}>{group}</strong></>}
        {(from || to) && <> · {from || '…'} – {to || '…'}</>}
        {!from && !to && <> · semua tanggal</>}
      </div>

      {/* Stats load failure - distinct from genuine zeros so admins know to retry. */}
      {!loading && error && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '3px solid #8B3A2A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#8B3A2A' }}>
            Gagal memuat statistik permintaan. Angka di bawah tidak tersedia.
          </span>
          <button
            onClick={fetchStats}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid #8B3A2A', borderRadius: '0.375rem', fontSize: '0.8rem', color: '#8B3A2A', cursor: 'pointer' }}
          >
            <RefreshCw size={13} />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── A. Pending Requests - the primary admin view ─────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', margin: '0 0 0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
          Menunggu Diproses
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Belum diekspor dan belum selesai - ini antrian kerja Anda.
        </span>
      </div>

      {loading ? (
        <div className="cmd-grid" style={{ marginBottom: '1.5rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.125rem' }}>
              <div className="skeleton" style={{ height: '18px', width: '60%', marginBottom: '0.75rem' }} />
              <div className="skeleton" style={{ height: '36px', width: '48px', marginBottom: '0.375rem' }} />
              <div className="skeleton" style={{ height: '10px', width: '70px', marginBottom: '0.75rem' }} />
              <div className="skeleton" style={{ height: '10px', width: '90%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Statistik tidak tersedia. Gunakan &quot;Coba lagi&quot; di atas untuk memuat ulang.
        </div>
      ) : (
        <>
          <div className="cmd-grid" style={{ marginBottom: '0.875rem' }}>
            {PLU_REQUEST_TYPES.map((t) => (
              <PendingCard
                key={t}
                type={t}
                stat={statOf(t)}
                audit={scoped?.lastUpdated?.[t] ?? null}
                onClick={() => openQueue(t)}
              />
            ))}

            {/* Total Pending - the one number that answers "how much work is left?". */}
            <div
              className="card"
              style={{ padding: '1.125rem', borderLeft: `3px solid ${(summary?.pending ?? 0) > 0 ? 'var(--accent-gold)' : 'var(--border)'}`, background: 'var(--bg-card)' }}
            >
              <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', textAlign: 'right' }}>
                Total Pending
              </div>
              <div style={{ fontSize: '2.25rem', fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1, color: (summary?.pending ?? 0) > 0 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                {summary?.pending ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                menunggu proses ({SOURCE_LABELS[source]})
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                Semua jenis permintaan PLU digabung.
              </div>
            </div>
          </div>

          {summary && summary.pending === 0 && (
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Tidak ada permintaan yang menunggu proses{hasFilter ? ' untuk filter ini' : ''}. Anda bisa memeriksa
              item <strong style={{ color: 'var(--text-primary)' }}>Sudah diekspor</strong> atau <strong style={{ color: 'var(--text-primary)' }}>Selesai</strong> di halaman Export.
            </div>
          )}
        </>
      )}

      {/* ── C. Processing Status Summary ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', margin: '1.5rem 0 0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
          Status Pemrosesan
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Siklus hidup permintaan untuk filter di atas.
        </span>
      </div>

      {loading ? (
        <StatCardSkeleton />
      ) : error ? null : (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div className="lifecycle-grid">
            <LifecycleTile label="Pending" sub="Menunggu proses" value={summary?.pending ?? null} color={STATUS_COLORS.PENDING} accent={(summary?.pending ?? 0) > 0} />
            <LifecycleTile label="Exported" sub="Sudah diekspor" value={summary?.exported ?? null} color={STATUS_COLORS.EXPORTED} />
            <LifecycleTile label="Done" sub="Selesai" value={summary?.done ?? null} color={STATUS_COLORS.DONE} />
            <LifecycleTile label="Total Requests" sub="Semua status" value={summary?.total ?? null} />
          </div>
          {(summary?.costControl ?? 0) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
              Termasuk dalam Total: <strong style={{ color: '#7A2E1F' }}>{summary?.costControl}</strong> item masih di cost control
              {(summary?.rejected ?? 0) > 0 ? ` · ${summary?.rejected} ditolak` : ''}.
            </div>
          )}
        </div>
      )}

      {/* ── Other queues (separate data sources, never folded into the totals above) ── */}
      {!loading && !error && (
        <div className="other-grid" style={{ marginBottom: '1.5rem' }}>
          <div
            className="card"
            onClick={() => router.push('/admin/discount')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') router.push('/admin/discount'); }}
            style={{ padding: '1rem 1.125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <Percent size={17} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>Discount</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {scoped?.discount.pending ?? 0} menunggu · {scoped?.discount.done ?? 0} selesai · {scoped?.discount.total ?? 0} total
              </div>
            </div>
          </div>
          <div
            className="card"
            onClick={() => router.push('/admin/removal')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') router.push('/admin/removal'); }}
            style={{ padding: '1rem 1.125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <Trash2 size={17} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>Request Removal</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Halaman pemrosesan Remove PLU - angkanya sama dengan kartu Remove PLU di atas.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── D. All-Time Summary - explicitly NOT a pending count ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', margin: '0 0 0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
          All-Time Summary
        </h2>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Total sepanjang waktu, semua sumber - <strong>tidak</strong> terpengaruh filter di atas dan <strong>bukan</strong> jumlah pending.
        </span>
      </div>

      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '3px solid var(--border)' }}>
        {loading ? (
          <div className="alltime-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '58px' }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tidak tersedia.</div>
        ) : (
          <div className="alltime-grid">
            {PLU_REQUEST_TYPES.map((t) => (
              <div key={t} style={{ textAlign: 'center', padding: '0.625rem', borderRadius: '6px', background: 'var(--bg-cream)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.375rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {allTime?.byType?.[t]?.total ?? '—'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', letterSpacing: '0.05em' }}>
                  Total {TYPE_LABELS[t]}
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'center', padding: '0.625rem', borderRadius: '6px', background: 'var(--bg-cream)', border: '1px solid var(--accent-gold)' }}>
              <div style={{ fontSize: '1.375rem', fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--accent-gold)', lineHeight: 1 }}>
                {allTime?.summary.done ?? '—'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', letterSpacing: '0.05em' }}>
                Total Done
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .cmd-grid { display: grid; gap: 0.875rem; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 768px) { .cmd-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1100px) { .cmd-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1360px) { .cmd-grid { grid-template-columns: repeat(6, 1fr); } }
        .lifecycle-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 768px) { .lifecycle-grid { grid-template-columns: repeat(4, 1fr); } }
        .alltime-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 640px) { .alltime-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1100px) { .alltime-grid { grid-template-columns: repeat(6, 1fr); } }
        .other-grid { display: grid; gap: 0.875rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .other-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
