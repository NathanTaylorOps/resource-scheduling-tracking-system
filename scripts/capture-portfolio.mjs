import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;
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
  const nextBin = require.resolve('next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch();

    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
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
    const mobilePage = await mobile.newPage();
    await open(mobilePage, '/field');
    await shot(mobilePage, 'field-mobile', { fullPage: true });
    await mobile.close();
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
