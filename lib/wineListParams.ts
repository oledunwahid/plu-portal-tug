/**
 * Query-string → WineListFilters. Shared by GET /api/wines and GET /api/wines/export so an export
 * always reproduces exactly what the list on screen was showing (PRD §14: "respect filters").
 */

import type { WineListFilters, WineSortKey } from './wineDb';

const SORT_KEYS: WineSortKey[] = ['wineName', 'vintage', 'producer', 'price', 'updatedAt', 'createdAt'];
export const WINE_PAGE_SIZES = [25, 50, 100];

export function parseWineListParams(searchParams: URLSearchParams): {
  filters: WineListFilters;
  page: number;
  limit: number;
} {
  const rawSort = searchParams.get('sort') as WineSortKey | null;
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : 'updatedAt';
  const requested = Number(searchParams.get('limit') ?? 25);
  const limit = WINE_PAGE_SIZES.includes(requested) ? requested : 25;
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const statusParam = searchParams.get('status');
  const completeness = searchParams.get('completeness');

  const filters: WineListFilters = {
    search: searchParams.get('search') ?? undefined,
    // Default to Active only: an inactive wine never disappears from the data, but it takes the
    // status filter to bring it back on screen (PRD §12).
    status: statusParam === 'ALL' ? 'ALL' : statusParam === 'Inactive' ? 'Inactive' : 'Active',
    producerId: searchParams.get('producerId') ?? undefined,
    countryId: searchParams.get('countryId') ?? undefined,
    regionId: searchParams.get('regionId') ?? undefined,
    appellationId: searchParams.get('appellationId') ?? undefined,
    wineTypeId: searchParams.get('wineTypeId') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    bottleSizeId: searchParams.get('bottleSizeId') ?? undefined,
    vintage: searchParams.get('vintage') ?? undefined,
    outlet: searchParams.get('outlet') ?? undefined,
    completeness: completeness === 'COMPLETE' || completeness === 'INCOMPLETE' ? completeness : undefined,
    duplicatesOnly: searchParams.get('duplicates') === '1',
    sort,
    dir: searchParams.get('dir') === 'asc' ? 'asc' : 'desc',
    limit,
    offset: (page - 1) * limit,
  };
  return { filters, page, limit };
}
