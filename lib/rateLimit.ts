// In-memory fixed-window rate limiter.
//
// SCOPE: this app runs as a single Node process on cPanel (see server-start.js), so a
// module-level Map is a correct shared counter. If the deployment ever becomes
// multi-process or multi-instance, this must move to the SQLite file or a shared store -
// otherwise each worker enforces its own quota.

interface Bucket {
  count: number;
  /** Epoch ms at which this window expires and the count resets. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// The map only grows when new keys appear, and every key expires. Sweep on write so a
// long-lived process doesn't accumulate dead entries from one-off IPs.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  // Collect first, then delete: the tsconfig target predates Map iteration, and mutating
  // while iterating is best avoided regardless.
  const expired: string[] = [];
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) expired.push(key);
  });
  for (const key of expired) buckets.delete(key);
}

export interface RateLimitResult {
  ok: boolean;
  /** Attempts still allowed in the current window. */
  remaining: number;
  /** Seconds until the window resets - 0 when the request was allowed. */
  retryAfter: number;
}

/**
 * Counts one attempt against `key`. Returns ok=false once `limit` attempts have been
 * made inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}

/** Clears the counter for a key - called after a successful login so a valid user is never locked out. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Best-effort client IP. Behind the cPanel/Passenger reverse proxy the socket address is
 * always the proxy, so the forwarded headers are the only signal available. They are
 * spoofable by a direct caller, which is why the login limiter also keys on the email
 * address - an attacker who rotates X-Forwarded-For still hits the per-account ceiling.
 *
 * Accepts either a fetch `Headers` (route handlers, middleware) or the plain object
 * NextAuth hands to `authorize()`.
 */
export function clientIp(headers: Headers | Record<string, unknown> | undefined): string {
  const read = (name: string): string => {
    if (!headers) return '';
    const raw = headers instanceof Headers
      ? headers.get(name)
      : (headers[name] ?? headers[name.toLowerCase()]);
    if (Array.isArray(raw)) return String(raw[0] ?? '');
    return raw == null ? '' : String(raw);
  };

  const forwarded = read('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return read('x-real-ip').trim() || 'unknown';
}
