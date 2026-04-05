import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protect dashboard and create routes server-side
// Supabase stores its session in a cookie named sb-{ref}-auth-token
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/dashboard') || pathname === '/create';

  if (!isProtected) return NextResponse.next();

  // Check for any Supabase auth cookie (works for both old and new SDK versions)
  const cookies = request.cookies.getAll();
  const hasSession = cookies.some(
    (c) =>
      c.name.includes('auth-token') ||
      c.name.includes('sb-') ||
      c.name === 'supabase-auth-token'
  );

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/create'],
};
