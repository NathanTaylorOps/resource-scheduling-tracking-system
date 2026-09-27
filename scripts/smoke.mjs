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