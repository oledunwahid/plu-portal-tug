import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getReconcileSessionById, getReconcileRows, getNotInFisikMasters, getMasterItems,
} from '@/lib/db';
import { parseReconcileRowFilters, bestFuzzyCandidate, type ReconcileMasterRef } from '@/lib/reconcile';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function appendSheet(wb: XLSX.WorkBook, name: string, headers: string[], rows: (string | number)[][]) {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reconcileSession = await getReconcileSessionById(params.sessionId);
    if (!reconcileSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const filters = parseReconcileRowFilters(new URL(req.url).searchParams);

    // Each sheet gets only the filters that make sense for it (a price-diff filter
    // is meaningless for unmatched rows, a sub-group filter for rows with no master).
    const [matchedRows, notInCloudRows, notInFisik] = await Promise.all([
      getReconcileRows(params.sessionId, { ...filters, tab: 'matched' }),
      getReconcileRows(params.sessionId, {
        tab: 'not_in_cloud', codeType: filters.codeType, search: filters.search,
      }),
      getNotInFisikMasters(params.sessionId, reconcileSession.department, {
        subGroup: filters.subGroup, search: filters.search,
      }),
    ]);

    // Best fuzzy candidate per unmatched row needs the same master scope the match used.
    const masterItems = await getMasterItems({
      department: reconcileSession.department !== 'ALL' ? reconcileSession.department : undefined,
      active: true, limit: 100000,
    });
    const masterRefs: ReconcileMasterRef[] = masterItems.map((m) => ({
      code: m.code, name: m.name, price: m.price, barcode: m.barcode,
    }));

    const wb = XLSX.utils.book_new();

    appendSheet(wb, 'Cocok',
      ['Fisik Code', 'Code Type', 'Fisik Name', 'Master Code', 'Master Name', 'Fisik Price', 'Master Price', 'Price Diff', 'Price Match', 'Confidence', 'Match Method', 'Sub Group'],
      matchedRows.map((r) => [
        r.fisikCode, r.codeType, r.fisikName, r.matchedMasterCode ?? '', r.matchedMasterName ?? '',
        r.fisikPrice ?? '', r.matchedMasterPrice ?? '', r.priceDiff ?? '',
        r.priceMatch == null ? '' : (r.priceMatch ? 'Yes' : 'No'),
        r.matchConfidence, r.matchMethod, r.subGroup ?? '',
      ]),
    );

    appendSheet(wb, 'Tidak di Cloud',
      ['Fisik Code', 'Code Type', 'Fisik Name', 'Fisik Price', 'Fisik Qty', 'Best Fuzzy Candidate', 'Best Fuzzy Score'],
      notInCloudRows.map((r) => {
        const best = bestFuzzyCandidate(r.fisikName, masterRefs);
        return [
          r.fisikCode, r.codeType, r.fisikName, r.fisikPrice ?? '', r.fisikQty ?? '',
          best?.name ?? '', best ? Number(best.score.toFixed(3)) : '',
        ];
      }),
    );

    appendSheet(wb, 'Tidak di Fisik',
      ['Master Code', 'Master Name', 'Master Price', 'Outlets', 'Sub Group'],
      notInFisik.map((m) => [
        m.code, m.name, m.price ?? '',
        (m.outlets ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).join(' '),
        m.category ?? '',
      ]),
    );

    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeLabel = reconcileSession.label.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40) || 'sesi';
    const filename = `rekonsiliasi-${safeLabel}-${dateStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/kb/reconcile/[sessionId]/export]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
