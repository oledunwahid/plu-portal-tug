import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserById } from './db';
import { getOutletGroup } from './outlets';

export const authOptions = {
  session: { strategy: 'jwt' as const, maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Direct SQLite query via sql.js (pure WASM) - bypasses Prisma's native engine.
        // Prisma's .so.node binary gets killed by cPanel's resource limits.
        const user = await getUserByEmail(credentials.email);

        if (!user) return null;
        // active is stored as INTEGER 0/1 - falsy check works for both
        if (!user.active) throw new Error('INACTIVE_ACCOUNT');

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          outlet: user.outlet,
          outletGroup: getOutletGroup(user.outlet),
          accountType: user.accountType,
          businessUnit: user.businessUnit,
          winePermissions: user.winePermissions,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.outlet = user.outlet;
        token.outletGroup = user.outletGroup;
        token.accountType = user.accountType ?? null;
        token.businessUnit = user.businessUnit ?? null;
        token.winePermissions = user.winePermissions ?? null;
      } else if (token?.id && token.accountType === undefined) {
        // Sessions minted before the Wine List module existed carry no accountType. Backfill once
        // (the claim is then persisted in the cookie, and `null` is a value so we never re-query),
        // otherwise a Wine PIC with a live 30-day session would have to sign out to get access.
        const existing = await getUserById(token.id);
        token.accountType = existing?.accountType ?? null;
        token.businessUnit = existing?.businessUnit ?? null;
        token.winePermissions = existing?.winePermissions ?? null;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.outlet = token.outlet;
        session.user.outletGroup = token.outletGroup;
        session.user.accountType = token.accountType ?? null;
        session.user.businessUnit = token.businessUnit ?? null;
        session.user.winePermissions = token.winePermissions ?? null;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
