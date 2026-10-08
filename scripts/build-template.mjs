import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const templatePath = path.join(process.cwd(), 'prisma', 'template.db');

function run(modulePath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [modulePath, ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(modulePath)} exited with code ${code}`));
    });
  });
}

await rm(templatePath, { force: true });

const env = { DATABASE_URL: 'file:./template.db' };
const prismaBin = require.resolve('prisma/build/index.js');
const tsxBin = require.resolve('tsx/dist/cli.mjs');

await run(prismaBin, ['db', 'push', '--skip-generate'], env);
await run(tsxBin, ['prisma/seed.ts'], env);
