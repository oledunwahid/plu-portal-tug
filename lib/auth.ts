import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserById } from './db';
import { getOutletGroup } from './outlets';
import { rateLimit, resetRateLimit, clientIp } from './rateLimit';

// A missing secret makes NextAuth fall back to an unstable value: sessions silently
// break on restart, and in some configurations tokens become forgeable. Fail loudly at
// boot in production rather than shipping a portal with unsigned sessions.
//
// The build phase is exempt: `next build` sets NODE_ENV=production and imports this
// module to collect route metadata, but the secret is RUNTIME config that the build
// machine (a CI runner) has no business holding. Asserting during the build would make
// every CI build fail for a condition that only matters when actually serving requests.
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';
if (!NEXTAUTH_SECRET && process.env.NODE_ENV === 'production' && !IS_BUILD_PHASE) {
  throw new Error('NEXTAUTH_SECRET is not set - refusing to start with an unsigned session secret.');
}

// Login throttling. Two independent windows, both counted on every failed attempt:
//  - per account: stops a slow credential-stuffing run against one known email even when
//    the attacker rotates source IPs (X-Forwarded-For is caller-controlled behind a proxy).
//  - per IP: stops one host from sweeping many accounts.
// Both reset on a successful sign-in so a legitimate user who mistypes is never locked out.
const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS_PER_ACCOUNT = 8;
const MAX_ATTEMPTS_PER_IP = 30;

export const authOptions = {
  secret: NEXTAUTH_SECRET,
  session: { strategy: 'jwt' as const, maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  // Debug output includes token internals; keep it off outside local development.
  debug: false,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Normalised so 'A@x.com' and 'a@x.com' share one throttle bucket.
        const emailKey = credentials.email.trim().toLowerCase();
        const ip = clientIp(req?.headers as Record<string, unknown> | undefined);
        const accountKey = `login:acct:${emailKey}`;
        const ipKey = `login:ip:${ip}`;

        const byAccount = rateLimit(accountKey, MAX_ATTEMPTS_PER_ACCOUNT, LOGIN_WINDOW_MS);
        const byIp = rateLimit(ipKey, MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_MS);
        if (!byAccount.ok || !byIp.ok) {
          throw new Error('TOO_MANY_ATTEMPTS');
        }

        // Direct SQLite query via sql.js (pure WASM) - bypasses Prisma's native engine.
        // Prisma's .so.node binary gets killed by cPanel's resource limits.
        const user = await getUserByEmail(credentials.email);

        if (!user) return null;
        // active is stored as INTEGER 0/1 - falsy check works for both
        if (!user.active) throw new Error('INACTIVE_ACCOUNT');

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) return null;

        resetRateLimit(accountKey);
        resetRateLimit(ipKey);

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
