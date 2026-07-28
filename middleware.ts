import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { tokenCanAccessWineList, WINE_ACCESS_DENIED_MESSAGE } from '@/lib/winePermissions';

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

export default withAuth(
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

export const config = {
  matcher: ['/admin/:path*', '/cashier/:path*', '/cost-control/:path*', '/wine/:path*'],
};
