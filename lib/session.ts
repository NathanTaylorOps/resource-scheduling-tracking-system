/**
 * The name of the cookie that identifies a visitor's own private session —
 * shared between middleware.ts (which sets it) and lib/db.ts (which reads
 * it to route that visitor to their own database). Kept as its own module
 * so the two never drift out of sync on the cookie name.
 *
 * See the "RSTS: per-visitor hosting plan" doc for the full design this
 * supports: every visitor to the hosted demo gets an isolated copy of the
 * seeded data, gone after they've been idle a while, so two people
 * browsing the live link at once never see each other's changes.
 */
export const SESSION_COOKIE = 'rsts_session';
