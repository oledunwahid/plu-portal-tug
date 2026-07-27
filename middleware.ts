import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

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
  matcher: ['/admin/:path*', '/cashier/:path*', '/cost-control/:path*'],
};
