/**
 * Wine Cork account branding.
 *
 * Applies ONLY when the signed-in account is a Wine PIC. Every other account (cashier, cost control,
 * admin) keeps the global PLU Management System identity and its "[ROLE] · [OUTLET]" subtitle - the
 * global logo is never replaced.
 *
 * Client-safe: imported by the sidebar and top bar.
 */

import { isWinePic, WINE_PIC_ROLE_LABEL, type WineAccessUser } from './winePermissions';

/** Cork & Screw mark, already present in public/assets. */
export const WINE_CORK_LOGO = '/assets/logo.png';
export const WINE_CORK_NAME = 'Wine Cork';

export interface AccountIdentity {
  /** Display name, unchanged from the account's own name. */
  name: string;
  /** Second line under the name. `null` hides it entirely. */
  subtitle: string | null;
  /** Logo to show in the sidebar / header, or null to keep the text wordmark. */
  logoSrc: string | null;
  logoAlt: string | null;
  isWinePic: boolean;
}

export interface IdentitySourceUser extends WineAccessUser {
  name?: string | null;
  outlet?: string | null;
}

/**
 * Single source of truth for how an account presents itself, so the sidebar and the top bar can
 * never disagree.
 *
 * Wine Cork → name "Wine Cork", subtitle "WINE PIC", Cork & Screw logo, and NO outlet suffix: the
 * Wine List covers all Cork & Screw wine data, so showing "CASHIER · CSSG" made a group-wide account
 * look like one outlet's cashier.
 */
export function getAccountIdentity(user: IdentitySourceUser | null | undefined): AccountIdentity {
  const name = String(user?.name ?? '').trim();

  if (isWinePic(user)) {
    return {
      name: name || WINE_CORK_NAME,
      subtitle: WINE_PIC_ROLE_LABEL,
      logoSrc: WINE_CORK_LOGO,
      logoAlt: `${WINE_CORK_NAME} logo`,
      isWinePic: true,
    };
  }

  const role = String(user?.role ?? '').trim();
  const outlet = String(user?.outlet ?? '').trim();
  let subtitle: string | null = null;
  if (role === 'ADMIN') subtitle = 'ADMIN · HEAD OFFICE';
  else if (role === 'COST_CONTROL') subtitle = 'COST CONTROL';
  else if (role) subtitle = outlet ? `${role} · ${outlet}` : role;

  return { name, subtitle, logoSrc: null, logoAlt: null, isWinePic: false };
}
