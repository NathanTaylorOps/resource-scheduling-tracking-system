import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const PAGES_TO_CHECK = ['/', '/jobs', '/equipment'];

let failed = false;
const results = [];

async function check(label, fn) {
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`  ok - ${label}`);
  } catch (err) {
    failed = true;
    results.push({ label, ok: false, error: err });
    console.log(`  FAIL - ${label}`);
    console.log(`    ${err.message}`);
  }
}

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(url);
          if (res.ok || res.status < 500) return resolve();
        } catch {
          // server not up yet - keep polling
        }
        await sleep(300);
      }
      reject(new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`));
    })();
  });
}

async function main() {
  console.log(`Starting "next start -p ${PORT}"...`);
  const nextBin = require.resolve('next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let serverOutput = '';
  server.stdout.on('data', (d) => (serverOutput += d.toString()));
  server.stderr.on('data', (d) => (serverOutput += d.toString()));

  let browser;
  try {
    await waitForServer(BASE_URL);
    console.log('Server is up.');

    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
    });

    console.log('Checking the dashboard renders...');
    await check('dashboard heading renders', async () => {
      const res = await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      if (!res || !res.ok()) throw new Error(`GET / returned ${res?.status()}`);
      const heading = page.getByRole('heading', { name: 'Operations dashboard', level: 1 });
      await heading.waitFor({ state: 'visible', timeout: 5000 });
    });

    await check('absolute social image metadata is present', async () => {
      const og = await page.locator('meta[property="og:image"]').evaluateAll(
        (elements) => elements.map((element) => element.getAttribute('content')),
      );
      const twitter = await page.locator('meta[name="twitter:image"]').evaluateAll(
        (elements) => elements.map((element) => element.getAttribute('content')),
      );
      const all = [...og, ...twitter].filter(Boolean);
      if (!og.some((url) => url?.includes('/opengraph-image'))) {
        throw new Error('Missing Open Graph screenshot image: ' + JSON.stringify(og));
      }
      if (!twitter.some((url) => url?.includes('/opengraph-image'))) {
        throw new Error('Missing Twitter screenshot image: ' + JSON.stringify(twitter));
      }
      for (const url of all) {
        if (!url?.startsWith('https://')) throw new Error('Metadata image URL is not absolute HTTPS: ' + url);
      }
    });

    await check('share image serves a real 1200x630 PNG', async () => {
      // Request the image from the running local deployment, not from GitHub.
      const response = await fetch(BASE_URL + '/opengraph-image');
      if (!response.ok) throw new Error('GET /opengraph-image returned ' + response.status);
      if (!(response.headers.get('content-type') || '').includes('image/png')) {
        throw new Error('Share image has incorrect MIME type: ' + response.headers.get('content-type'));
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5_000_000 || bytes.length < 1000) {
        throw new Error('Share image size is invalid: ' + bytes.length);
      }
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
        throw new Error('Share image is not valid PNG');
      }
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      if (width !== 1200 || height !== 630) {
        throw new Error('Share image has incorrect dimensions: ' + width + 'x' + height);
      }
    });

    console.log('Checking accessibility (axe-core, serious/critical only) across pages...');
    for (const path of PAGES_TO_CHECK) {
      await check(`no serious/critical accessibility violations on ${path}`, async () => {
        const res = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
        if (!res || !res.ok()) throw new Error(`GET ${path} returned ${res?.status()}`);
        await page.addScriptTag({ path: require.resolve('axe-core') });
        const axeResults = await page.evaluate(async () => await window.axe.run());
        const seriousOrWorse = axeResults.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        if (seriousOrWorse.length > 0) {
          const detail = seriousOrWorse
            .map(
              (v) =>
                `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
                v.nodes
                  .map(
                    (n) =>
                      `    target: ${JSON.stringify(n.target)}\n    ${(n.failureSummary || '').replace(/\n/g, ' | ')}`,
                  )
                  .join('\n'),
            )
            .join('\n');
          throw new Error(`accessibility violations on ${path}:\n${detail}`);
        }
        const minorOrModerate = axeResults.violations.length - seriousOrWorse.length;
        if (minorOrModerate > 0) {
          console.log(`    (${minorOrModerate} minor/moderate violation(s) on ${path} logged, not failing)`);
        }
      });
    }

    await check('no console or page errors across checked pages', async () => {
      if (pageErrors.length > 0) {
        throw new Error(pageErrors.join('\n'));
      }
    });
  } catch (err) {
    failed = true;
    console.log(`FAIL - ${err.message}`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await sleep(500);
    try {
      server.kill('SIGKILL');
    } catch {
      // already exited - fine
    }
  }

  console.log('');
  const passCount = results.filter((r) => r.ok).length;
  console.log(`${passCount}/${results.length} checks passed.`);

  if (failed) {
    console.log('\n--- server output (for debugging) ---');
    console.log(serverOutput.slice(-4000));
    process.exit(1);
  }
}

main();