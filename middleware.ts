import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Assigns every visitor a private session cookie on their first request, so
 * lib/db.ts can hand them their own isolated copy of the demo data instead
 * of the single shared database this app uses when run locally. See the
 * "RSTS: per-visitor hosting plan" doc for why — in short: hosted on one
 * server, every visitor would otherwise land on the same database and could
 * see, or overwrite, whatever the last visitor did.
 *
 * Runs on the Edge runtime (Next's default for middleware), so it only ever
 * touches the cookie, never the database — provisioning that visitor's
 * actual SQLite file happens per-request in lib/db.ts, which runs in the
 * Node runtime where file access is available.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // One day — comfortably longer than the 30-minute idle cleanup in
    // lib/db.ts, so a visitor who returns within the day either keeps their
    // still-live session or simply gets a fresh one provisioned if it was
    // already swept. The cookie's own lifetime isn't what deletes data.
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export const config = {
  // Every page and API route needs a session; only static assets and
  // Next's own internals are skipped.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
