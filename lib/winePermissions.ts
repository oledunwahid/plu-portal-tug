/**
 * Wine List access control.
 *
 * Deliberately NOT a new `role`. Adding a fourth role would mean auditing every `role === 'CASHIER'`
 * branch in the portal (middleware, sidebar, request routes, notification variants) and risking the
 * live cashier flows. Instead a Wine PIC stays CASHIER-shaped for all existing flows and carries two
 * additive columns:
 *
 *   accountType  = 'WINE_PIC'   → the dedicated Wine PIC account (Wine Cork)
 *   businessUnit = 'Wine Cork'  → brand label used for branding, not for outlet scoping
 *
 * A non-WINE_PIC user can still be granted Wine List access explicitly through
 * User.winePermissions ('ALL', or a semicolon-separated list of the names below) - that is the
 * maintenance path for Admin/Superadmin, who otherwise get no Wine List menu.
 *
 * This module is imported by both client components and route handlers, so it must stay free of
 * `lib/db` / node-only imports.
 */

export const WINE_PERMISSIONS = [
  'WINE_LIST_VIEW',
  'WINE_LIST_CREATE',
  'WINE_LIST_EDIT',
  'WINE_LIST_CHANGE_STATUS',
  'WINE_LIST_IMPORT',
  'WINE_LIST_EXPORT',
  'WINE_LIST_VIEW_COST',
  'WINE_LIST_MANAGE_MASTER_DATA',
] as const;

export type WinePermission = (typeof WINE_PERMISSIONS)[number];

export const WINE_PIC_ACCOUNT_TYPE = 'WINE_PIC';
export const WINE_PIC_BUSINESS_UNIT = 'Wine Cork';
/** Subtitle shown instead of "CASHIER · CSSG" for the Wine Cork account. */
export const WINE_PIC_ROLE_LABEL = 'WINE PIC';

/** The full set a Wine PIC gets - Wine Cork owns its own catalog end to end. */
const WINE_PIC_PERMISSIONS: readonly WinePermission[] = WINE_PERMISSIONS;

/**
 * Shape this module needs from a user. Both the NextAuth session user and a DbUser row satisfy it,
 * so callers can pass either without adapting.
 */
export interface WineAccessUser {
  role?: string | null;
  accountType?: string | null;
  businessUnit?: string | null;
  winePermissions?: string | null;
  active?: boolean | null;
}

export function isWinePic(user: WineAccessUser | null | undefined): boolean {
  return String(user?.accountType ?? '').trim().toUpperCase() === WINE_PIC_ACCOUNT_TYPE;
}

function parseGrantList(raw: string | null | undefined): WinePermission[] {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.toUpperCase() === 'ALL') return [...WINE_PERMISSIONS];
  const wanted = new Set(
    value.split(/[;,]/).map((p) => p.trim().toUpperCase()).filter(Boolean),
  );
  return WINE_PERMISSIONS.filter((p) => wanted.has(p));
}

/**
 * Effective Wine List permissions for a user. An inactive account resolves to none, so a
 * deactivated Wine PIC loses Wine List access without any extra check at each call site.
 */
export function resolveWinePermissions(user: WineAccessUser | null | undefined): WinePermission[] {
  if (!user) return [];
  // `active` is optional on the session user (sessions only exist for active accounts) - only an
  // explicit `false` blocks.
  if (user.active === false) return [];
  if (isWinePic(user)) return [...WINE_PIC_PERMISSIONS];
  return parseGrantList(user.winePermissions);
}

export function hasWinePermission(
  user: WineAccessUser | null | undefined,
  permission: WinePermission,
): boolean {
  return resolveWinePermissions(user).includes(permission);
}

/** True when the user may see the Wine List section at all (menu + any /wine route). */
export function canAccessWineList(user: WineAccessUser | null | undefined): boolean {
  return hasWinePermission(user, 'WINE_LIST_VIEW');
}

/** Cost per Bottle is commercially sensitive - stripped server-side for everyone else. */
export function canViewWineCost(user: WineAccessUser | null | undefined): boolean {
  return hasWinePermission(user, 'WINE_LIST_VIEW_COST');
}

/**
 * Edge-safe variant used by middleware, which only has the raw JWT claims to work with.
 * Mirrors resolveWinePermissions but reads a plain token object.
 */
export function tokenCanAccessWineList(token: Record<string, unknown> | null | undefined): boolean {
  if (!token) return false;
  return canAccessWineList({
    role: token.role as string | undefined,
    accountType: token.accountType as string | undefined,
    winePermissions: token.winePermissions as string | undefined,
  });
}

export const WINE_ACCESS_DENIED_MESSAGE = 'Wine List hanya tersedia untuk akun Wine Cork.';
export const WINE_COST_DENIED_MESSAGE = 'Anda tidak memiliki akses untuk melihat cost.';
