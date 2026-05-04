import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    if (pathname === '/cashier') {
      return NextResponse.redirect(new URL('/cashier/dashboard', req.url));
    }

    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/cashier/dashboard', req.url));
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
  matcher: ['/admin/:path*', '/cashier/:path*'],
};
