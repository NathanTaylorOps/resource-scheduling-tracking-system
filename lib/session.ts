/**
 * The visitor-session cookie shared between middleware.ts (which issues it)
 * and lib/db.ts (which maps it to that visitor's own SQLite file). Kept in
 * one dependency-free module so the cookie name and the rule for what
 * counts as a valid session id can never drift apart, and so the validator
 * is testable under tsx without Prisma or Next installed.
 */
export const SESSION_COOKIE = 'rsts_session';

// Session ids are minted by crypto.randomUUID() in middleware.ts, so a real
// one is always an RFC 4122 UUID. The cookie value is still untrusted input
// on every request — it ends up in a filesystem path in lib/db.ts — so
// anything that isn't exactly a UUID is rejected before it gets near a path.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
