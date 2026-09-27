import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, isValidSessionId } from '@/lib/session';

/**
 * Assigns every visitor a private session cookie on their first request, so
 * lib/db.ts can hand them their own isolated copy of the demo data. Hosted
 * on one server, every visitor would otherwise land on the same database
 * and could see, or overwrite, whatever the last visitor did.
 *
 * A cookie that exists but isn't a UUID is replaced rather than passed
 * through: the value ends up in a filesystem path in lib/db.ts, so a
 * tampered cookie is treated exactly like a missing one.
 *
 * Runs on the Edge runtime (Next's default for middleware), so it only ever
 * touches the cookie, never the database — provisioning that visitor's
 * actual SQLite file happens per-request in lib/db.ts, which runs in the
 * Node runtime where file access is available.
 */

// Every new session provisions a brand-new SQLite copy in lib/db.ts, with no
// cap on how many a single visitor can spin up. This is a simple per-IP
// throttle on *creating* a session (not on ordinary requests, which reuse
// an existing valid cookie) so one client script can't exhaust disk on the
// hosted demo by looping with cookies cleared. It's a real but modest
// safeguard, not a hardened one: the counters live in this module's memory,
// so they reset on a redeploy or restart, and every visitor behind the same
// NAT or corporate proxy shares one bucket. Both are acceptable trade-offs
// for a free-tier demo running as the single persistent process this app's
// README describes — a distributed deployment would need a shared store
// (Redis, or Render's own rate limiting) instead of this module-scope map.
const SESSION_RATE_LIMIT = 20; // new sessions
const SESSION_RATE_WINDOW_MS = 60 * 60 * 1000; // per IP, per rolling hour
const sessionCreationsByIp = new Map<string, number[]>();

function clientIp(request: NextRequest): string {
  // Render (like most hosts behind a proxy) sets x-forwarded-for; the first
  // entry is the original client. Falling back to a constant bucket when
  // neither header is present means an unidentifiable client still shares
  // the *global* limit rather than bypassing it entirely.
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** True if this IP has already created SESSION_RATE_LIMIT sessions within the current rolling window; otherwise records this creation and returns false. */
function isSessionCreationRateLimited(ip: string, now: number): boolean {
  const recent = (sessionCreationsByIp.get(ip) ?? []).filter((t) => now - t < SESSION_RATE_WINDOW_MS);
  if (recent.length >= SESSION_RATE_LIMIT) {
    sessionCreationsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  sessionCreationsByIp.set(ip, recent);
  return false;
}

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionId(existing)) {
    return NextResponse.next();
  }

  const now = Date.now();
  const ip = clientIp(request);
  if (isSessionCreationRateLimited(ip, now)) {
    return new NextResponse('Too many new sessions from this address. Please try again in a while.', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(SESSION_RATE_WINDOW_MS / 1000)) },
    });
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
