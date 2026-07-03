// Shared in-memory cache for the Data Quality duplicate engine.
//
// Two things are memoised, both keyed by a cheap DB fingerprint (row count +
// latest timestamp) so the cache invalidates on import but survives rapid
// filter/search/pagination requests:
//
//   1. Light duplicate groups (grouping + cheap SAP-free classification).
//   2. The SAP token index (WINE only) used for lazy per-group evidence.
//
// A pending Promise is shared while a computation is in flight, so concurrent
// requests for the same key don't kick off duplicate (expensive) work.

import {
  getAllMasterItemsForMatch, getAllSapItemsForMatch,
  getMasterItemsStamp, getSapItemsStamp,
} from './db';
import {
  buildLightGroups, buildSapIndex,
  type DupGroup, type DupFilterOptions, type SapIndex,
} from './dupAnalysis';

const TTL_MS = 60_000;

interface LightGroupsCache {
  key: string;
  at: number;
  groups: DupGroup[];
  byKey: Map<string, DupGroup>;
  filterOptions: DupFilterOptions;
}

let lightCache: LightGroupsCache | null = null;
let lightPending: { key: string; promise: Promise<LightGroupsCache> } | null = null;

export async function getLightGroupsCached(): Promise<LightGroupsCache> {
  const stamp = await getMasterItemsStamp();
  const key = `m:${stamp.count}:${stamp.maxUpdatedAt}`;
  const now = Date.now();

  if (lightCache && lightCache.key === key && now - lightCache.at < TTL_MS) return lightCache;
  if (lightPending && lightPending.key === key) return lightPending.promise;

  const promise = (async (): Promise<LightGroupsCache> => {
    const masters = await getAllMasterItemsForMatch();
    const built = buildLightGroups(masters);
    const byKey = new Map(built.groups.map((g) => [g.key, g]));
    const cache: LightGroupsCache = { key, at: Date.now(), groups: built.groups, byKey, filterOptions: built.filterOptions };
    lightCache = cache;
    return cache;
  })();

  lightPending = { key, promise };
  try {
    return await promise;
  } finally {
    if (lightPending && lightPending.key === key) lightPending = null;
  }
}

interface SapIndexCache { key: string; at: number; index: SapIndex; }

let sapCache: SapIndexCache | null = null;
let sapPending: { key: string; promise: Promise<SapIndex> } | null = null;

// Cached SAP token index. All SapMasterItem rows are WINE, so no department
// filtering is needed here — callers gate on WINE before asking for evidence.
export async function getSapIndexCached(): Promise<SapIndex> {
  const stamp = await getSapItemsStamp();
  const key = `s:${stamp.count}:${stamp.maxImportedAt}`;
  const now = Date.now();

  if (sapCache && sapCache.key === key && now - sapCache.at < TTL_MS) return sapCache.index;
  if (sapPending && sapPending.key === key) return sapPending.promise;

  const promise = (async (): Promise<SapIndex> => {
    const saps = await getAllSapItemsForMatch();
    const index = buildSapIndex(saps);
    sapCache = { key, at: Date.now(), index };
    return index;
  })();

  sapPending = { key, promise };
  try {
    return await promise;
  } finally {
    if (sapPending && sapPending.key === key) sapPending = null;
  }
}
