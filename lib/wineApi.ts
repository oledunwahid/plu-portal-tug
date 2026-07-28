/**
 * Server-side guard for every Wine List route handler.
 *
 * Hiding the menu is not access control: each handler calls requireWinePermission() first, so a
 * direct API call from an account without the permission gets 403 regardless of what the UI showed.
 */

import { NextResponse } from 'next/server';
import { getSession, type AppUser } from './session';
import {
  hasWinePermission,
  canViewWineCost,
  WINE_ACCESS_DENIED_MESSAGE,
  type WinePermission,
} from './winePermissions';

export interface WineGuardResult {
  user: AppUser;
  /** Whether Cost per Bottle may be returned to this caller. */
  canViewCost: boolean;
}

/**
 * Returns either the caller (allowed) or a ready-to-return NextResponse (401/403).
 *
 * Usage:
 *   const guard = await requireWinePermission('WINE_LIST_VIEW');
 *   if ('response' in guard) return guard.response;
 *   const { user, canViewCost } = guard;
 */
export async function requireWinePermission(
  permission: WinePermission,
): Promise<WineGuardResult | { response: NextResponse }> {
  const session = await getSession();
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!hasWinePermission(session.user, permission)) {
    return {
      response: NextResponse.json(
        { error: WINE_ACCESS_DENIED_MESSAGE, permission },
        { status: 403 },
      ),
    };
  }
  return { user: session.user, canViewCost: canViewWineCost(session.user) };
}

/**
 * Strips costPerBottle unless the caller holds WINE_LIST_VIEW_COST. Applied on the way out of every
 * handler that can return wine records, so cost can never leak through a list, detail or export
 * payload even if a client asks for it.
 */
export function stripCost<T extends { costPerBottle?: number | null }>(
  record: T,
  canViewCost: boolean,
): T {
  if (canViewCost) return record;
  const { costPerBottle: _omitted, ...rest } = record;
  return { ...rest, costPerBottle: null } as T;
}

export function stripCostFromAll<T extends { costPerBottle?: number | null }>(
  records: T[],
  canViewCost: boolean,
): T[] {
  if (canViewCost) return records;
  return records.map((r) => stripCost(r, canViewCost));
}

/** Consistent 500 body - the client shows WINE_MESSAGES.loadFailed for any non-2xx read. */
export function wineServerError(scope: string, err: unknown): NextResponse {
  console.error(`[wine] ${scope}`, err);
  return NextResponse.json(
    { error: 'Data Wine List gagal dimuat. Silakan coba kembali.' },
    { status: 500 },
  );
}
