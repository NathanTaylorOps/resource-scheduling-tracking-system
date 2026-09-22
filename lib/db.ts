import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_COOKIE } from './session';

// Where each visitor's private SQLite file lives. Local disk on whatever
// process is running the app — fine for this app's design, since a
// visitor's data is meant to be temporary in the first place (see the
// hosting plan's "Inactivity cleanup"), and a redeploy wiping every
// in-progress session is an acceptable tradeoff, not a bug. Overridable via
// SESSIONS_DIR so a deployment can point it somewhere else if it ever needs
// to.
const SESSIONS_DIR = process.env.SESSIONS_DIR ?? path.join(os.tmpdir(), 'rsts-sessions');

// A fully migrated, fully seeded database built once — see
// scripts/build-template-db.ts (run as `npm run db:build-template`) — and
// copied per visitor rather than re-migrated and re-seeded on every single
// visit, which would make a first page load noticeably slower for no
// benefit: every visitor is meant to see the same starting data anyway.
const TEMPLATE_DB_PATH = path.join(process.cwd(), 'prisma', 'template.db');

// A generous ceiling for a low-traffic portfolio demo, not a real capacity
// limit — see the hosting plan's "Resource ceilings." Past this, the
// longest-idle session is dropped to make room for a new visitor rather
// than refusing them outright.
const MAX_CONCURRENT_SESSIONS = 200;

// Matches the 30-minute window recorded in the hosting plan's Decisions.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface PooledClient {
  client: PrismaClient;
  lastUsedAt: number;
}

// Standard Next.js dev-mode HMR-safety pattern (see the previous version of
// this file): without stashing the pool on globalThis, a dev-server file
// save would drop every visitor's pooled connection without disconnecting
// it first. Not load-bearing in production, where the module only loads
// once.
const globalForPool = globalThis as unknown as { rstsSessionPool?: Map<string, PooledClient> };
const pool: Map<string, PooledClient> = globalForPool.rstsSessionPool ?? new Map();
if (process.env.NODE_ENV !== 'production') {
  globalForPool.rstsSessionPool = pool;
}

function sessionDbPath(sessionId: string): string {
  // Session ids come from crypto.randomUUID() in middleware.ts, so this
  // never sees anything but a UUID — no untrusted input reaches a file
  // path here.
  return path.join(SESSIONS_DIR, `${sessionId}.db`);
}

function disposeSession(sessionId: string): void {
  const entry = pool.get(sessionId);
  if (entry) {
    // Fire-and-forget: a slow disconnect shouldn't hold up the request that
    // triggered this cleanup.
    entry.client.$disconnect().catch(() => {});
    pool.delete(sessionId);
  }
  fs.rm(sessionDbPath(sessionId), { force: true }, () => {});
}

/**
 * Deletes any pooled session that's been idle past IDLE_TIMEOUT_MS. Called
 * opportunistically on a small fraction of requests (see getDb, below)
 * rather than on a timer: a standard `next start` process has no
 * background-job hook to hang a real interval off, and piggybacking on
 * ordinary request traffic is the honest equivalent — see the hosting
 * plan's "Inactivity cleanup" for why this is a timed sweep rather than
 * true delete-on-tab-close, which a server has no way to detect directly.
 */
function sweepIdleSessions(): void {
  const now = Date.now();
  for (const [sessionId, entry] of pool) {
    if (now - entry.lastUsedAt > IDLE_TIMEOUT_MS) {
      disposeSession(sessionId);
    }
  }
}

function ensureSessionDatabase(sessionId: string): void {
  const dbPath = sessionDbPath(sessionId);
  if (fs.existsSync(dbPath)) return;

  if (!fs.existsSync(TEMPLATE_DB_PATH)) {
    throw new Error(
      'prisma/template.db is missing. Run "npm run db:build-template" once before starting the server (see README, "Getting started").',
    );
  }
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.copyFileSync(TEMPLATE_DB_PATH, dbPath);
}

/**
 * Returns the current visitor's own Prisma client, provisioning their
 * private database on the first call of their session. Every API route and
 * server-rendered page reads and writes through this instead of a single
 * shared connection, so visitors on the hosted demo never see each other's
 * data — see the "RSTS: per-visitor hosting plan" doc.
 *
 * Must be called from a route handler or a server component's render path
 * (anywhere Next's `cookies()` is valid) — not from module scope.
 */
export function getDb(): PrismaClient {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    throw new Error(
      'Missing session cookie — this request did not go through middleware.ts. ' +
        'If this fires locally, confirm middleware.ts is present at the project root.',
    );
  }

  // Cheap, request-count-based sampling rather than a real scheduler — see
  // sweepIdleSessions' own comment.
  if (Math.random() < 0.05) {
    sweepIdleSessions();
  }

  const existing = pool.get(sessionId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.client;
  }

  if (pool.size >= MAX_CONCURRENT_SESSIONS) {
    const [oldestSessionId] = [...pool.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)[0];
    disposeSession(oldestSessionId);
  }

  ensureSessionDatabase(sessionId);
  const client = new PrismaClient({ datasourceUrl: `file:${sessionDbPath(sessionId)}` });
  pool.set(sessionId, { client, lastUsedAt: Date.now() });
  return client;
}
