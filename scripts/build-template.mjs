import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const templatePath = path.join(process.cwd(), 'prisma', 'template.db');

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await rm(templatePath, { force: true });

const env = { DATABASE_URL: 'file:./template.db' };
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

await run(npx, ['prisma', 'db', 'push', '--skip-generate'], env);
await run(npx, ['tsx', 'prisma/seed.ts'], env);
