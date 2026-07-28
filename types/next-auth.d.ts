declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      outlet: string;
      outletGroup: string;
      // Wine List module - additive business identity, see lib/winePermissions.ts.
      accountType: string | null;
      businessUnit: string | null;
      winePermissions: string | null;
    };
  }
  interface User {
    role: string;
    outlet: string;
    outletGroup: string;
    accountType: string | null;
    businessUnit: string | null;
    winePermissions: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    outlet: string;
    outletGroup: string;
    accountType: string | null;
    businessUnit: string | null;
    winePermissions: string | null;
  }
}
