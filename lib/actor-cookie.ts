/**
 * Just the cookie name — split out of lib/actor.ts so a client component
 * (components/RoleSwitcher.tsx) can import it without dragging in
 * getViewingActor's `next/headers` `cookies()` call. next/headers is
 * server-only; a client component that imports anything from the same
 * module, even a plain string constant it never uses, still pulls the
 * whole module into the client bundle and fails the build ("You're
 * importing a component that needs next/headers"). lib/actor.ts
 * re-exports this for its own (server-only) callers, so nothing else
 * needs to change which file it imports from.
 */
export const ACTOR_COOKIE = 'rsts_actor';
