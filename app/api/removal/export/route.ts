import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPLURequests } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const outletGroup = searchParams.get('outletGroup') ?? undefined;
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const requests = await getPLURequests({
      requestType: 'REMOVE_PLU',
      status: status && status !== 'ALL' ? status : undefined,
      outletGroup: outletGroup && outletGroup !== 'ALL' ? outletGroup : undefined,
      from,
      to,
      limit: 2000,
      orderAsc: true,
    });

    const rows = requests.map((r) => ({
      'PLU CODE': r.code ?? '',
      'ITEM NAME': r.name,
      'FOLDER': r.folder ?? '',
      'REMARKS': r.remarks ?? '',
      'OUTLET': r.cashierOutlet,
      'SUBMITTED BY': r.submittedBy?.name ?? '',
      'DATE': r.createdAt.split('T')[0],
      'STATUS': r.status,
      'ADMIN NOTE': r.adminNote ?? '',
    }));

    const headers = ['PLU CODE', 'ITEM NAME', 'FOLDER', 'REMARKS', 'OUTLET', 'SUBMITTED BY', 'DATE', 'STATUS', 'ADMIN NOTE'];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    ws['!cols'][1] = { wch: 30 };
    ws['!cols'][3] = { wch: 40 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Removal Requests');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const date = new Date().toISOString().split('T')[0];
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="removal-requests-${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/removal/export]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
