import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import net from 'node:net';

const require = createRequire(import.meta.url);
let BASE_URL;

async function reserveFreePort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
const OUT = process.env.PORTFOLIO_SCREENSHOTS_DIR || 'docs/assets';

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function open(page, path) {
  const res = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) throw new Error(`GET ${path} returned ${res?.status()}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(250);
}

async function shot(page, name, options = {}) {
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
  });
  console.log(`captured ${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const port = await reserveFreePort();
  if (!port) throw new Error('Could not allocate a free local port for screenshot capture');
  BASE_URL = `http://127.0.0.1:${port}`;
  const nextBin = require.resolve('next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let browser;
  let serverOutput = '';
  server.stdout.on('data', (d) => (serverOutput += d.toString()));
  server.stderr.on('data', (d) => (serverOutput += d.toString()));
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch();

    const sessionId = randomUUID();

    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await desktop.addCookies([
      {
        name: 'rsts_session',
        value: sessionId,
        url: BASE_URL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await desktop.newPage();

    await open(page, '/');
    await shot(page, 'dashboard');

    await open(page, '/actions');
    await shot(page, 'action-centre');

    await open(page, '/');
    const jobLink = page.locator('a[href^="/jobs/"]').first();
    const href = await jobLink.getAttribute('href');
    if (!href) throw new Error('Could not locate a seeded job link from the dashboard');
    await open(page, href);
    await shot(page, 'job-readiness', { fullPage: true });

    await open(page, '/equipment');
    await shot(page, 'equipment');

    await desktop.close();

    const mobile = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await mobile.addCookies([
      {
        name: 'rsts_session',
        value: sessionId,
        url: BASE_URL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const mobilePage = await mobile.newPage();
    await open(mobilePage, '/field');
    await shot(mobilePage, 'field-mobile', { fullPage: true });
    await mobile.close();
  } catch (error) {
    console.error('\n--- next start output ---');
    console.error(serverOutput.slice(-12000));
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await sleep(500);
    try { server.kill('SIGKILL'); } catch {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
