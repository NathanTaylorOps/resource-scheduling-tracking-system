import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SESSION_COOKIE, isValidSessionId } from './session';
import { warmAllJobsWeather } from './weather/cache';

// Where each visitor's private SQLite file lives. Local disk on whatever
// process is running the app — a visitor's data is meant to be temporary,
// so a redeploy wiping every in-progress session is an accepted tradeoff.
// Overridable via SESSIONS_DIR.
const SESSIONS_DIR = path.resolve(process.env.SESSIONS_DIR ?? path.join(os.tmpdir(), 'rsts-sessions'));

// A fully migrated, fully seeded database built once by `npm run
// db:build-template` (see package.json) and copied per visitor, rather than
// re-migrated and re-seeded on every first visit.
const TEMPLATE_DB_PATH = path.join(process.cwd(), 'prisma', 'template.db');

// Ceiling on live per-visitor Prisma clients. Each holds an open SQLite
// connection plus a query-engine process, so this is sized for the 512 MB
// the hosted demo runs on, not for real traffic. Past it, the longest-idle
// session is dropped to make room rather than refusing the new visitor.
const MAX_CONCURRENT_SESSIONS = 40;

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface PooledClient {
  client: PrismaClient;
  lastUsedAt: number;
}

// Standard Next.js dev-mode HMR-safety pattern: without stashing the pool on
// globalThis, a dev-server file save would drop every visitor's pooled
// connection without disconnecting it first. Not load-bearing in
// production, where the module only loads once.
const globalForPool = globalThis as unknown as { rstsSessionPool?: Map<string, PooledClient> };
const pool: Map<string, PooledClient> = globalForPool.rstsSessionPool ?? new Map();
if (process.env.NODE_ENV !== 'production') {
  globalForPool.rstsSessionPool = pool;
}

/**
 * Resolves a session id to its database file, refusing anything that isn't
 * a UUID or that would resolve outside SESSIONS_DIR. The cookie value is
 * untrusted on every request; both checks run even though middleware.ts
 * has already replaced any non-UUID cookie, so no caller can reach a path
 * like ../prisma/template.db through this function.
 */
function sessionDbPath(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Refusing to resolve a database path for a malformed session id.');
  }
  const resolved = path.resolve(SESSIONS_DIR, `${sessionId}.db`);
  if (!resolved.startsWith(SESSIONS_DIR + path.sep)) {
    throw new Error('Refusing to resolve a session database path outside the sessions directory.');
  }
  return resolved;
}

function disposeSession(sessionId: string): void {
  const entry = pool.get(sessionId);
  if (entry) {
    // Fire-and-forget: a slow disconnect shouldn't hold up the request that
    // triggered this cleanup.
    entry.client.$disconnect().catch(() => {});
    pool.delete(sessionId);
  }
  if (!isValidSessionId(sessionId)) return;
  fs.rm(sessionDbPath(sessionId), { force: true }, () => {});
}

/**
 * Deletes any pooled session that's been idle past IDLE_TIMEOUT_MS. Called
 * opportunistically on a small fraction of requests (see getDb) rather than
 * on a timer: a standard `next start` process has no background-job hook to
 * hang a real interval off, and piggybacking on ordinary request traffic is
 * the honest equivalent. A server can't detect a closed tab, so a timed
 * idle sweep is what "cleaned up after you leave" actually means here.
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
    // can both pass that check, but only one copy can win when the
    // destination must not already exist — the loser's EEXIST means someone
    // else already provisioned this session, which is fine.
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
 * only reaches sessions the current process still remembers — a restart
 * clears `pool` without touching SESSIONS_DIR — so without this, files from
 * before the most recent restart would accumulate on disk indefinitely.
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
    if (!isValidSessionId(sessionId)) continue; // Not one of ours — leave it alone.
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
 * data.
 *
 * Must be called from a route handler or a server component's render path
 * (anywhere Next's `cookies()` is valid) — not from module scope.
 */
export function getDb(): PrismaClient {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    // middleware.ts issues or replaces the cookie before any page or route
    // runs, so this only fires if a request bypassed it entirely.
    throw new Error(
      'Missing or malformed session cookie — this request did not go through middleware.ts. ' +
        'If this fires locally, confirm middleware.ts is present at the project root.',
    );
  }

  // Cheap, request-count-based sampling rather than a real scheduler — see
  // sweepIdleSessions.
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
  // can hit SQLITE_BUSY against the file lock the first one is holding.
  const client = new PrismaClient({ datasourceUrl: `file:${sessionDbPath(sessionId)}?connection_limit=1` });
  pool.set(sessionId, { client, lastUsedAt: Date.now() });

  // Fire-and-forget: warm every job's weather cache right away rather than
  // leaving it empty until a visitor happens to open each job's own detail
  // page. Never awaited — the request that triggered provisioning shouldn't
  // wait on external fetches, and a failure here must never surface as this
  // request failing.
  warmAllJobsWeather(client).catch((err) => {
    console.error('Weather cache warm-up failed for a new session (non-fatal):', err);
  });

  return client;
}
