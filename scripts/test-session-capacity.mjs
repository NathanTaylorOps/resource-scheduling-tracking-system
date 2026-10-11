// Multi-visitor HTTP capacity stress for the single-process SQLite demo.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const port = 3198;
const base = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(path.join(os.tmpdir(), 'rsts-capacity-'));
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)], {
  env: { ...process.env, SESSIONS_DIR: directory, RSTS_SESSION_TEST_TRACE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output += chunk.toString(); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server exited during startup');
    try {
      const response = await fetch(`${base}/favicon.ico`);
      if (response.status < 500) { ready = true; break; }
    } catch { /* booting */ }
    await sleep(250);
  }
  assert.ok(ready, 'Server failed to start');
  const visitors = 44;
  const results = await Promise.all(Array.from({ length: visitors }, async (_, index) => {
    const response = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `rsts_session=${randomUUID()}` },
      body: JSON.stringify({
        name: `Capacity-${randomUUID()}-${index}`,
        address: 'Synthetic Test Site, Seattle, WA',
        latitude: 47.61, longitude: -122.33,
        startDate: '2026-10-01', targetEndDate: '2026-11-01',
        weatherSensitivity: 'INSENSITIVE',
      }),
      signal: AbortSignal.timeout(90000),
    });
    return response.status;
  }));
  const counts = output.match(/RSTS_TEST_POOL_SIZE (\d+)/g) ?? [];
  assert.ok(counts.length > 0, 'missing pool telemetry');
  const sizes = counts.map(record => Number(record.split(' ').at(-1)));
  const maximum = Math.max(...sizes);
  assert.ok(maximum <= 40, `pool exceeded configured maximum: ${maximum}`);
  assert.ok(results.some(status => status === 201), 'no successful visits');
  // Capacity rejection currently surfaces as HTTP 500; distinguish expected
  // saturation from unrelated failures using the matching server-side error.
  if (results.some(status => status !== 201)) {
    assert.ok(results.every(status => status === 201 || status === 500),
      `unexpected statuses: ${results.join(',')}`);
    assert.ok(output.includes('Demo session capacity reached'),
      'a rejected request must be caused by a known capacity limit');
  }
  assert.ok(!output.includes('Cannot dispose a session with active requests'),
    'eviction attempted to dispose a leased client');
  console.log(`PASS ${visitors} distinct visitors: peak pool ${maximum}, ${results.filter(x=>x===201).length} accepted, ${results.filter(x=>x!==201).length} capacity-rejected`);
} catch (err) {
  console.error(err);
  console.error(output.slice(-8000));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await sleep(500);
  if (server.exitCode === null) server.kill('SIGKILL');
  await rm(directory, { recursive: true, force: true });
}
