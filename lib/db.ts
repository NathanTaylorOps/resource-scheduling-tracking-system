import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_COOKIE } from './session';
import { warmAllJobsWeather } from './weather/cache';

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
  try {
    // COPYFILE_EXCL makes this atomic against the existsSync check above:
    // two near-simultaneous first requests for the same brand-new session
    // (a double-click, a retried fetch) can both pass that check and both
    // reach here, but only one copyFileSync call can win when the
    // destination must not already exist — the loser throws EEXIST, which
    // is exactly the outcome we want (someone already provisioned this
    // session, nothing left to do) rather than a real error.
    fs.copyFileSync(TEMPLATE_DB_PATH, dbPath, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EEXIST') {
      return;
    }
    throw err;
  }
}

/**
 * Deletes session .db files on disk that are older than IDLE_TIMEOUT_MS and
 * not currently held by this process's in-memory pool. sweepIdleSessions
 * above only reaches sessions the current process still remembers — a
 * redeploy or restart clears `pool` (see the comment on globalForPool)
 * without touching SESSIONS_DIR, so without this, every session file a
 * process ever provisioned before its most recent restart stays on disk
 * forever, growing unbounded under any deployment that restarts
 * periodically. Reads the directory rather than tracking file creation
 * times separately, so it self-heals even after a restart with no pool
 * state to work from at all.
 */
function sweepOrphanedSessionFiles(): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return; // Directory doesn't exist yet — nothing to sweep.
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.db')) continue;
    const sessionId = entry.name.slice(0, -3);
    if (pool.has(sessionId)) continue; // Live in this process — sweepIdleSessions owns it.
    const filePath = path.join(SESSIONS_DIR, entry.name);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > IDLE_TIMEOUT_MS) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {
      // Another process/request may have already removed it — fine either way.
    }
  }
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
    sweepOrphanedSessionFiles();
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
  // connection_limit=1 forces every query from this visitor's client
  // through one real SQLite connection instead of letting Prisma's pool
  // open several. Without it, two writes racing from the same visitor (two
  // open tabs, or a background weather refresh landing mid-form-submit)
  // can open a second connection that hits SQLITE_BUSY against the file
  // lock the first one is already holding — with no retry, that surfaces
  // as a raw 500 instead of the clean 409s this app otherwise returns for
  // every other kind of conflict.
  const client = new PrismaClient({ datasourceUrl: `file:${sessionDbPath(sessionId)}?connection_limit=1` });
  pool.set(sessionId, { client, lastUsedAt: Date.now() });

  // Fire-and-forget: warm every job's weather cache right away rather than
  // leaving it empty until a visitor happens to open each job's own detail
  // page. Without this, a fresh visitor's dashboard reads every job's
  // weather as "not yet checked" — see warmAllJobsWeather's own comment for
  // why that's worse than it sounds. Never awaited: the request that
  // triggered session provisioning shouldn't wait on N external fetches to
  // NWS and Open-Meteo before it can render, and a failure here (a network
  // hiccup, NWS being down) must never surface as this request failing —
  // the per-job weather panel still refreshes on its own view either way.
  warmAllJobsWeather(client).catch((err) => {
    console.error('Weather cache warm-up failed for a new session (non-fatal):', err);
  });

  return client;
}
