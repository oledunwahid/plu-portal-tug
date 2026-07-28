'use client';

import { useState, useEffect, useCallback } from 'react';
import { WINE_MASTER_DATA_TYPES, type WineMasterDataType } from '@/lib/wine';
import type { WineOption } from './WineSelect';

export type WineMasterDataMap = Record<WineMasterDataType, WineOption[]>;

function emptyMap(): WineMasterDataMap {
  return WINE_MASTER_DATA_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as WineMasterDataMap);
}

interface RawItem {
  id: string;
  type: string;
  name: string;
  normalizedName: string;
}

/**
 * Loads every wine reference list in one request (`/api/wine-master-data/ALL`) and groups it by type.
 * All ten dropdowns on the wine form read from this, so opening the form costs one round trip rather
 * than ten. `addOption` folds an inline-created record straight into the cache.
 */
export function useWineMasterData(): {
  data: WineMasterDataMap;
  loading: boolean;
  failed: boolean;
  reload: () => void;
  addOption: (type: WineMasterDataType, option: WineOption) => void;
} {
  const [data, setData] = useState<WineMasterDataMap>(emptyMap);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/wine-master-data/ALL')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((payload: { items: RawItem[] }) => {
        if (cancelled) return;
        const next = emptyMap();
        for (const item of payload.items ?? []) {
          const type = item.type as WineMasterDataType;
          if (next[type]) {
            next[type].push({ id: item.id, name: item.name, normalizedName: item.normalizedName });
          }
        }
        setData(next);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [nonce]);

  const addOption = useCallback((type: WineMasterDataType, option: WineOption) => {
    setData((prev) => {
      if (prev[type].some((o) => o.id === option.id)) return prev;
      return {
        ...prev,
        [type]: [...prev[type], option].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
  }, []);

  return { data, loading, failed, reload: () => setNonce((n) => n + 1), addOption };
}
