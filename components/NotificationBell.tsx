'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2 } from 'lucide-react';
import { formatTimestamp } from '@/lib/format';

// Mirror the cashier dashboard's request-type labels for badge consistency.
const TYPE_LABELS: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  UPDATE_FULL: 'Full Update',
  REMOVE_PLU: 'Remove PLU',
};

interface Notification {
  id: string;
  source: 'single' | 'batch';
  requestType: string;
  title: string;
  itemCount: number;
  createdAt: string;
  submittedByName: string;
  submittedByOutlet: string;
  read: boolean;
}

// Relative time in Indonesian, with an absolute fallback for anything older than a week.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return 'baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'kemarin';
  if (day < 7) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BADGE_STYLE: React.CSSProperties = {
  fontSize: '0.68rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)',
  border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', whiteSpace: 'nowrap',
};

// `variant` controls where the bell navigates and how each card reads. admin → the export queue /
// admin dashboard; cost-control → the cost-control dashboard (where PENDING_COST_CONTROL items are
// reviewed); cashier → their own dashboard, showing "Siap Sync" DONE notifications.
export function NotificationBell({ variant = 'admin' }: { variant?: 'admin' | 'cost-control' | 'cashier' }) {
  const router = useRouter();
  const isCashier = variant === 'cashier';
  const dashboardHref =
    variant === 'cost-control' ? '/cost-control/dashboard'
    : isCashier ? '/cashier/dashboard'
    : '/admin/dashboard';
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Leave previous state in place on a transient failure.
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial page load — establishes the red-dot state without opening the panel.
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Lightweight polling so a newly-arrived notification (e.g. a request just marked DONE) surfaces
  // without a manual refresh. 45s is a gentle cadence; no WebSocket. Applies to every variant.
  useEffect(() => {
    const id = setInterval(fetchNotifications, 45000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Re-fetch on each open (per spec: refresh count on bell click) — but the red dot
    // is NOT cleared by opening; only "Tandai semua dibaca" clears it.
    if (next) fetchNotifications();
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    // Optimistic: clear the dot and tint immediately, no reload needed.
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/admin/notifications/read-all', { method: 'POST' });
    } catch {
      // Reconcile with the server on failure.
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  function handleCardClick(n: Notification) {
    // Mark this one read (fire-and-forget) and navigate to where it's processed.
    // Does not clear the red dot — that's reserved for "mark all as read".
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      fetch(`/api/admin/notifications/read/${encodeURIComponent(n.id)}`, { method: 'POST' }).catch(() => {});
    }
    setOpen(false);
    // Cost control reviews everything from its own dashboard; cashier goes to their dashboard to
    // sync the DONE item; admin routes to the export queue.
    if (variant === 'cost-control') {
      router.push('/cost-control/dashboard');
    } else if (isCashier) {
      router.push('/cashier/dashboard');
    } else {
      router.push(`/admin/export?type=${encodeURIComponent(n.requestType)}`);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        title="Notifikasi"
        aria-label="Notifikasi"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '34px', height: '34px', borderRadius: '50%', background: 'transparent',
          border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px',
              borderRadius: '50%', background: '#C0392B', border: '1.5px solid var(--bg-card)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
            width: '360px', maxWidth: '92vw', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '0.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifikasi</span>
            <button
              onClick={handleMarkAll}
              disabled={markingAll || unreadCount === 0}
              style={{
                fontSize: '0.72rem', color: unreadCount === 0 ? 'var(--text-secondary)' : '#8B6914',
                background: 'none', border: 'none',
                cursor: markingAll || unreadCount === 0 ? 'default' : 'pointer',
                opacity: markingAll ? 0.6 : 1, fontWeight: 500, padding: 0,
              }}
            >
              Tandai semua dibaca
            </button>
          </div>

          {/* List — scrollable; ~5 cards visible, scroll for the rest */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Belum ada notifikasi.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  title={formatTimestamp(n.createdAt)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '0.625rem 0.875rem', border: 'none',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: n.read ? '3px solid transparent' : '3px solid #C9A84C',
                    background: n.read ? 'transparent' : 'rgba(201,168,76,0.06)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-cream)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(201,168,76,0.06)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.3rem' }}>
                    {isCashier ? (
                      <span style={{ fontSize: '0.62rem', color: '#1E7A46', background: 'rgba(30,122,70,0.08)', border: '1px solid rgba(30,122,70,0.25)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        Siap Sync
                      </span>
                    ) : (
                      <span style={BADGE_STYLE}>{TYPE_LABELS[n.requestType] ?? n.requestType}</span>
                    )}
                    {n.source === 'batch' ? (
                      <span style={{ fontSize: '0.62rem', color: '#8B6914', background: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', whiteSpace: 'nowrap' }}>
                        Batch · {n.itemCount}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', background: 'var(--bg-cream)', border: '1px solid var(--border)', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>
                        Single
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  {isCashier ? (
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {(n.source === 'batch' ? 'Batch ' : 'Item ') + (n.title || '—') + ' sudah DONE — siap untuk sync.'}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title || '—'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {n.submittedByName || 'Unknown'}{n.submittedByOutlet ? ` · ${n.submittedByOutlet}` : ''}
                      </div>
                    </>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '0.5rem 0.875rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              onClick={() => { setOpen(false); router.push(dashboardHref); }}
              style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Lihat semua
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
