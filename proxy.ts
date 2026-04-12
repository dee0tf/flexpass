// DISABLED: This server-side proxy checked for Supabase auth COOKIES,
// but our Supabase client uses localStorage for session persistence.
// The cookie check always failed, causing an infinite /login redirect loop.
//
// Auth protection is handled client-side in each dashboard page via
// supabase.auth.getSession().
//
// To re-enable server-side auth guards, switch to @supabase/ssr which
// uses cookie-based sessions, then restore this middleware.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
