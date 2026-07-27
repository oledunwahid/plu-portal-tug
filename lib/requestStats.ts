// Shared vocabulary + types for the admin request statistics shown on the Dashboard and the
// Export page. Both pages read /api/admin/stats/summary, so a label here means the same number
// everywhere it appears.

export type RequestStatsSource = 'single' | 'batch' | 'all';

export type PLURequestType = 'NEW_ITEM' | 'UPDATE_PRICE' | 'UPDATE_NAME' | 'UPDATE_PRINTER' | 'REMOVE_PLU';

export const PLU_REQUEST_TYPES: PLURequestType[] = [
  'NEW_ITEM', 'UPDATE_PRICE', 'UPDATE_NAME', 'UPDATE_PRINTER', 'REMOVE_PLU',
];

export interface TypeStat {
  pending: number;
  exported: number;
  done: number;
  costControl: number;
  rejected: number;
  total: number;
}

export interface StatsSummaryResponse {
  source: RequestStatsSource;
  dateRange: { from: string | null; to: string | null };
  outletGroup: string;
  search: string | null;
  summary: TypeStat;
  byType: Record<string, TypeStat>;
  discount: { pending: number; done: number; total: number };
  lastUpdated?: Record<string, { by: string; at: string } | null>;
}

export const EMPTY_TYPE_STAT: TypeStat = {
  pending: 0, exported: 0, done: 0, costControl: 0, rejected: 0, total: 0,
};

export const TYPE_LABELS: Record<PLURequestType, string> = {
  NEW_ITEM: 'New Items',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  REMOVE_PLU: 'Remove PLU',
};

// One wording per lifecycle stage, used on both pages so the same number never carries two names.
export const STATUS_LABELS = {
  PENDING:  { en: 'Pending',  id: 'Menunggu proses' },
  EXPORTED: { en: 'Exported', id: 'Sudah diekspor' },
  DONE:     { en: 'Done',     id: 'Selesai' },
  TOTAL:    { en: 'Total',    id: 'Total' },
} as const;

export const STATUS_COLORS = {
  PENDING: '#8B6914',
  EXPORTED: '#1F3A5F',
  DONE: '#2D4A2E',
  TOTAL: 'var(--text-secondary)',
} as const;

export const SOURCE_LABELS: Record<RequestStatsSource, string> = {
  single: 'Single Items',
  batch: 'Batch Items',
  all: 'All Request Sources',
};

export function sumStats(a: TypeStat, b: TypeStat): TypeStat {
  return {
    pending: a.pending + b.pending,
    exported: a.exported + b.exported,
    done: a.done + b.done,
    costControl: a.costControl + b.costControl,
    rejected: a.rejected + b.rejected,
    total: a.total + b.total,
  };
}

export function buildStatsQuery(opts: {
  source: RequestStatsSource;
  group?: string;
  from?: string;
  to?: string;
  search?: string;
  withAudit?: boolean;
}): string {
  const params = new URLSearchParams({ source: opts.source });
  if (opts.group && opts.group !== 'ALL') params.set('outletGroup', opts.group);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  if (opts.withAudit) params.set('withAudit', '1');
  return params.toString();
}
