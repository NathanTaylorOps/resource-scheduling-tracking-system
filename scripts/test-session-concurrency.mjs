// Real Next.js -> Prisma -> SQLite concurrency regression; CI-only synthetic data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const port = 3197;
const base = `http://127.0.0.1:${port}`;
const sessionId = randomUUID();
const directory = await mkdtemp(path.join(os.tmpdir(), 'rsts-concurrency-'));
const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)], {
  env: { ...process.env, SESSIONS_DIR: directory, RSTS_SESSION_TEST_TRACE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [next.stdout, next.stderr]) stream.on('data', (data) => { output += data.toString(); });
let db;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (next.exitCode !== null) throw new Error('Next.js exited before becoming ready');
    try {
      const response = await fetch(`${base}/favicon.ico`);
      if (response.status < 500) { ready = true; break; }
    } catch { /* booting */ }
    await delay(250);
  }
  assert.ok(ready, 'Next server never became ready');
  // The UUID cookie models a value issued by middleware but has never hit
  // getDb() before this burst: all requests race to provision one database.
  const count = 16;
  const tag = `Concurrency-${randomUUID()}`;
  const responses = await Promise.all(Array.from({ length: count }, (_, index) =>
    fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `rsts_session=${sessionId}` },
      body: JSON.stringify({
        name: `${tag}-${index}`,
        address: 'Synthetic Test Site, Seattle, WA',
        latitude: 47.61, longitude: -122.33,
        startDate: '2026-10-01', targetEndDate: '2026-11-01',
        weatherSensitivity: 'INSENSITIVE',
      }),
      signal: AbortSignal.timeout(45000),
    })
  ));
  const statuses = responses.map(response => response.status);
  assert.ok(statuses.every(status => status === 201), `Unexpected HTTP statuses: ${statuses.join(', ')}`);
  const sessionFiles = (await readdir(directory)).filter(name => name.endsWith('.db'));
  assert.deepEqual(sessionFiles, [`${sessionId}.db`], 'exactly one SQLite database should exist');
  db = new PrismaClient({ datasourceUrl: `file:${path.join(directory, sessionFiles[0])}` });
  const persisted = await db.job.count({ where: { name: { startsWith: tag } } });
  assert.equal(persisted, count, 'all concurrent writes must persist into the same session database');
  const created = output.split('RSTS_TEST_SESSION_CLIENT_CREATED').length - 1;
  assert.equal(created, 1, `expected exactly one Prisma client; observed ${created}`);
  console.log(`PASS ${count} concurrent HTTP writes, one session database/client, all records persisted`);
} catch (error) {
  console.error(error);
  console.error(output.slice(-6000));
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
  next.kill('SIGTERM');
  await delay(500);
  if (next.exitCode === null) next.kill('SIGKILL');
  await rm(directory, { recursive: true, force: true });
}
