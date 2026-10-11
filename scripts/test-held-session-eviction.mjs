// Holds an actual Next.js request open while 44 different visitors force pool churn.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, access, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const port = 3199;
const base = `http://127.0.0.1:${port}`;
const root = await mkdtemp(path.join(os.tmpdir(), 'rsts-held-request-'));
const sessionDir = path.join(root, 'sessions');
const holdDir = path.join(root, 'hold');
const { mkdir } = await import('node:fs/promises');
await mkdir(sessionDir);
await mkdir(holdDir);
const heldId = randomUUID();
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)], {
  env: { ...process.env, SESSIONS_DIR: sessionDir, RSTS_SESSION_TEST_TRACE: '1', RSTS_SESSION_HOLD_TEST_DIR: holdDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output += chunk.toString(); });

async function waitForFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await access(file); return; } catch { await sleep(50); }
  }
  throw new Error(`Timed out waiting for ${file}`);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server exited during startup');
    try {
      const response = await fetch(`${base}/favicon.ico`);
      if (response.status < 500) { ready = true; break; }
    } catch { /* starting */ }
    await sleep(250);
  }
  assert.ok(ready, 'Server never became ready');

  const heldResponsePromise = fetch(`${base}/api/test-session-lease`, {
    headers: { cookie: `rsts_session=${heldId}` },
    signal: AbortSignal.timeout(60000),
  });
  // A failed route should produce an immediate diagnostic, not a blind timeout.
  const readyFile = path.join(holdDir, 'ready');
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    try { await access(readyFile); break; } catch { /* waiting */ }
    const outcome = await Promise.race([
      heldResponsePromise.then(response => ({ earlyResponse: response.status })).catch(error => ({ earlyError: String(error) })),
      sleep(100).then(() => null),
    ]);
    if (outcome) throw new Error(`Held request ended before reaching barrier: ${JSON.stringify(outcome)}`);
  }
  await waitForFile(readyFile, 1000);
  await access(path.join(sessionDir, `${heldId}.db`));

  const results = await Promise.all(Array.from({ length: 44 }, async (_, i) => {
    const response = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `rsts_session=${randomUUID()}` },
      body: JSON.stringify({
        name: `Held-session-stress-${i}`, address: 'Synthetic CI site',
        latitude: 47.61, longitude: -122.33,
        startDate: '2026-10-01', targetEndDate: '2026-11-01',
        weatherSensitivity: 'INSENSITIVE',
      }),
      signal: AbortSignal.timeout(60000),
    });
    return response.status;
  }));

  // The held request must not be removed even if 44 other sessions fill the pool.
  await access(path.join(sessionDir, `${heldId}.db`));
  assert.ok(!output.includes('Cannot dispose a session with active requests'),
    'a live request was selected for disposal');
  const sizes = [...output.matchAll(/RSTS_TEST_POOL_SIZE (\d+)/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 0, 'no pool-size instrumentation');
  assert.ok(Math.max(...sizes) <= 40, 'session pool exceeded capacity');

  await writeFile(path.join(holdDir, 'release'), 'release');
  const held = await heldResponsePromise;
  assert.equal(held.status, 200, `held request failed with HTTP ${held.status}`);
  const body = await held.json();
  assert.equal(body.heldRequestFinished, true);
  assert.equal(typeof body.jobs, 'number');
  assert.ok(results.some(status => status === 201), 'no stress requests succeeded');
  assert.ok(results.every(status => status === 201 || status === 500),
    `unexpected stress statuses ${results.join(',')}`);
  if (results.includes(500)) {
    assert.ok(output.includes('Demo session capacity reached'),
      'stress request failures were not attributable to pool saturation');
  }
  console.log(`PASS held-open HTTP request survived 44-visitor pressure; pool peak ${Math.max(...sizes)}; held SQLite data remained readable`);
} catch (error) {
  console.error(error);
  console.error(output.slice(-8000));
  process.exitCode = 1;
} finally {
  // Always unblock the held request before shutting down, even on assertion errors.
  await writeFile(path.join(holdDir, 'release'), 'release').catch(() => {});
  server.kill('SIGTERM');
  await sleep(500);
  if (server.exitCode === null) server.kill('SIGKILL');
  await rm(root, { recursive: true, force: true });
}
