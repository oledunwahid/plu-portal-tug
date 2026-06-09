import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { countPLURequests, countRequestBatches, countDiscountRequests, getLastUpdatedForType, getLastUpdatedDiscount } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PLU_TYPES = ['NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'REMOVE_PLU'] as const;

type TypeStat = { pending: number; exported: number; done: number; total: number; lastUpdatedBy: string | null; lastUpdatedAt: string | null };

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result: Record<string, TypeStat> = {};

    // PLU types: combine single PLURequest records with batch RequestBatch records.
    await Promise.all(PLU_TYPES.map(async (type) => {
      const [singlePending, singleExported, singleDone, batchPending, batchExported, batchDone, lastUpdated] = await Promise.all([
        countPLURequests({ requestType: type, status: 'PENDING' }),
        countPLURequests({ requestType: type, status: 'EXPORTED' }),
        countPLURequests({ requestType: type, status: 'DONE' }),
        countRequestBatches({ requestType: type, status: 'PENDING' }),
        countRequestBatches({ requestType: type, status: 'EXPORTED' }),
        countRequestBatches({ requestType: type, status: 'DONE' }),
        getLastUpdatedForType(type),
      ]);
      const pending = singlePending + batchPending;
      const exported = singleExported + batchExported;
      const done = singleDone + batchDone;
      result[type] = {
        pending, exported, done, total: pending + exported + done,
        lastUpdatedBy: lastUpdated?.updatedBy ?? null,
        lastUpdatedAt: lastUpdated?.updatedAt ?? null,
      };
    }));

    // Discount requests (no EXPORTED state).
    const [discPending, discDone, discLast] = await Promise.all([
      countDiscountRequests({ status: 'PENDING' }),
      countDiscountRequests({ status: 'DONE' }),
      getLastUpdatedDiscount(),
    ]);
    result.DISCOUNT = {
      pending: discPending, exported: 0, done: discDone, total: discPending + discDone,
      lastUpdatedBy: discLast?.updatedBy ?? null,
      lastUpdatedAt: discLast?.updatedAt ?? null,
    };

    // Removal requests are REMOVE_PLU requests (single + batch) — surfaced under its own card.
    result.REMOVAL = { ...result.REMOVE_PLU };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/admin/stats/by-type]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
