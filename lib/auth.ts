import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from './db';
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

        // Direct SQLite query — bypasses Prisma's native engine entirely.
        // Prisma's .so.node binary gets killed by cPanel's resource limits;
        // better-sqlite3 is in-process and unaffected.
        const user = getUserByEmail(credentials.email);

        if (!user) return null;
        // active is stored as INTEGER 0/1 — falsy check works for both
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
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.outlet = token.outlet;
        session.user.outletGroup = token.outletGroup;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
