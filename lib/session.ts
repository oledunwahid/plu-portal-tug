import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  outlet: string;
  outletGroup: string;
  /** Wine List module - 'WINE_PIC' for the Wine Cork account, null for everyone else. */
  accountType: string | null;
  businessUnit: string | null;
  winePermissions: string | null;
}

export interface AppSession {
  user: AppUser;
}

export async function getSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  return session as unknown as AppSession | null;
}
