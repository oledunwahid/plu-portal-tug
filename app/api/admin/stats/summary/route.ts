import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getRequestStatsByType,
  countDiscountRequests,
  getLastUpdatedForType,
  type RequestStatsSource,
  type RequestTypeStat,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLU_TYPES = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'REMOVE_PLU'] as const;
const SOURCES: RequestStatsSource[] = ['single', 'batch', 'all'];

/**
 * Single source of truth for the admin Dashboard and Export page stat cards.
 *
 * Every number returned here means exactly one thing:
 *   pending     - submitted, not yet exported and not yet done (the admin's actual work queue)
 *   exported    - a file has been downloaded, still waiting to be marked done
 *   done        - completed
 *   costControl - NEW_ITEM still with cost control (not yet the admin's to process)
 *   rejected    - killed at cost control
 *   total       - every request in scope, whatever its status
 *
 * The counting unit is one item to process: a single PLURequest row, or one item inside a batch
 * (never one batch), which is exactly what the Export page lists.
 *
 * Query params: source=single|batch|all, outletGroup, from, to, search.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const rawSource = searchParams.get('source') ?? 'all';
    const source: RequestStatsSource = (SOURCES as string[]).includes(rawSource)
      ? (rawSource as RequestStatsSource)
      : 'all';
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const from        = searchParams.get('from') ?? undefined;
    const to          = searchParams.get('to') ?? undefined;
    const search      = searchParams.get('search') ?? undefined;
    const withAudit   = searchParams.get('withAudit') === '1';

    const byType = await getRequestStatsByType({ source, outletGroup, from, to, search });

    const summary = PLU_TYPES.reduce(
      (acc, t) => {
        const s: RequestTypeStat = byType[t];
        acc.pending += s.pending;
        acc.exported += s.exported;
        acc.done += s.done;
        acc.costControl += s.costControl;
        acc.rejected += s.rejected;
        acc.total += s.total;
        return acc;
      },
      { pending: 0, exported: 0, done: 0, costControl: 0, rejected: 0, total: 0 },
    );

    // Discount requests live in their own table and have no batch form, so they are reported
    // alongside - never folded into the PLU totals above.
    const [discPending, discDone, discTotal] = await Promise.all([
      countDiscountRequests({ status: 'PENDING', outletGroup, from, to }),
      countDiscountRequests({ status: 'DONE', outletGroup, from, to }),
      countDiscountRequests({ outletGroup, from, to }),
    ]);

    // The dashboard's "last updated by" footers - one extra query per type, so it's opt-in.
    let lastUpdated: Record<string, { by: string; at: string } | null> | undefined;
    if (withAudit) {
      const entries = await Promise.all(
        PLU_TYPES.map(async (t) => {
          const info = await getLastUpdatedForType(t);
          return [t, info ? { by: info.updatedBy, at: info.updatedAt } : null] as const;
        }),
      );
      lastUpdated = Object.fromEntries(entries);
    }

    return NextResponse.json({
      source,
      dateRange: { from: from ?? null, to: to ?? null },
      outletGroup: outletGroup ?? 'ALL',
      search: search ?? null,
      summary,
      byType,
      discount: { pending: discPending, done: discDone, total: discTotal },
      ...(lastUpdated ? { lastUpdated } : {}),
    });
  } catch (error) {
    console.error('[GET /api/admin/stats/summary]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
