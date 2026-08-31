import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { tokenCanAccessWineList, WINE_ACCESS_DENIED_MESSAGE } from '@/lib/winePermissions';

// ── CSRF: same-origin enforcement on state-changing API calls ────────────────
// Every route in this app authenticates from the NextAuth session cookie, so any
// cross-site request that the browser attaches that cookie to would act as the
// signed-in user. Two layers stop that:
//   1. The session cookie is SameSite=Lax (NextAuth's default), so it is not sent
//      on cross-site POST/PATCH/DELETE at all.
//   2. This check, as defence in depth for anything that slips past Lax.
// Every client fetch in this codebase is a same-origin relative '/api/...' call,
// so no legitimate traffic carries a foreign Origin.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfBlocked(req: NextRequest): NextResponse | null {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const origin = req.headers.get('origin');
  // No Origin header means a non-browser client (curl, a server-to-server call, a
  // health check). CSRF requires a browser that holds the cookie, and browsers always
  // send Origin on cross-site state-changing requests - so absence is not an attack.
  if (!origin) return null;

  // Behind the cPanel reverse proxy the app sees an internal host, so the public host
  // must come from the forwarded header rather than req.nextUrl.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  if (originHost === host) return null;

  // NEXTAUTH_URL is the canonical public origin; accept it too in case the proxy
  // rewrites Host to something else.
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      if (new URL(configured).host === originHost) return null;
    } catch {
      /* malformed config - fall through to the block below */
    }
  }

  return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
}

// The Wine List section answers 403 rather than redirecting: the PRD requires direct URL access
// without permission to be refused, and a silent bounce to the dashboard would look like the feature
// simply doesn't exist.
function wineForbidden(): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>403 · Wine List</title>
     <meta name="viewport" content="width=device-width,initial-scale=1"></head>
     <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF7F2;font-family:system-ui,sans-serif;color:#1C1107">
       <div style="text-align:center;padding:2rem">
         <div style="font-size:0.7rem;letter-spacing:0.14em;color:#6B5744;text-transform:uppercase;margin-bottom:0.5rem">403 Forbidden</div>
         <h1 style="font-size:1.25rem;margin:0 0 0.75rem">${WINE_ACCESS_DENIED_MESSAGE}</h1>
         <a href="/" style="font-size:0.85rem;color:#8B6914">Kembali ke halaman utama</a>
       </div>
     </body></html>`,
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

// The landing page each role belongs on - used both for bare-section redirects and for bouncing a
// user who wanders into a section they don't own.
function homeForRole(role: string | undefined): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'COST_CONTROL') return '/cost-control/dashboard';
  return '/cashier/dashboard';
}

const pageMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;
    const pathname = req.nextUrl.pathname;

    // Bare-section entrypoints → that section's dashboard.
    if (pathname === '/admin') return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    if (pathname === '/cashier') return NextResponse.redirect(new URL('/cashier/dashboard', req.url));
    if (pathname === '/cost-control') return NextResponse.redirect(new URL('/cost-control/dashboard', req.url));

    // Wine List is gated on the Wine List permission set, NOT on role - a Wine PIC keeps the CASHIER
    // role so every existing cashier flow is untouched. See lib/winePermissions.ts.
    if (pathname.startsWith('/wine')) {
      if (!tokenCanAccessWineList(token as Record<string, unknown> | null)) return wineForbidden();
      if (pathname === '/wine') return NextResponse.redirect(new URL('/wine/list', req.url));
      return NextResponse.next();
    }

    // Cost Control is granted read access to the Knowledge Base and full access to Price Check —
    // both live under /admin but are explicitly shared. Everything else under /admin stays ADMIN-only.
    const COST_CONTROL_SHARED_ADMIN = ['/admin/kb', '/admin/price-check'];

    // Positive role gates - each section is reachable only by its own role. Anyone else is bounced
    // to their own home (a COST_CONTROL user can no longer reach cashier or admin pages, etc.).
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      const sharedWithCostControl = COST_CONTROL_SHARED_ADMIN.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (!(role === 'COST_CONTROL' && sharedWithCostControl)) {
        return NextResponse.redirect(new URL(homeForRole(role), req.url));
      }
    }
    if (pathname.startsWith('/cashier') && role !== 'CASHIER') {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }
    if (pathname.startsWith('/cost-control') && role !== 'COST_CONTROL') {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // API routes do their own session + role checks and must answer with JSON, never with
  // withAuth's HTML redirect to /login - so they only get the CSRF gate here.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return csrfBlocked(req) ?? NextResponse.next();
  }
  return pageMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/cashier/:path*',
    '/cost-control/:path*',
    '/wine/:path*',
    '/api/:path*',
  ],
};
