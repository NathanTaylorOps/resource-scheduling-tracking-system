import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Enabled only for the isolated CI process. Never expose this endpoint in a normal deployment. */
export async function GET() {
  const testDir = process.env.RSTS_SESSION_HOLD_TEST_DIR;
  if (process.env.RSTS_SESSION_TEST_TRACE !== '1' || !testDir) {
    return new NextResponse('Not found', { status: 404 });
  }

  // getDb() acquires a request lease, which must stay held during this wait.
  const db = await getDb();
  const ready = path.join(testDir, 'ready');
  const release = path.join(testDir, 'release');
  await fs.writeFile(ready, 'ready');
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      await fs.access(release);
      const jobs = await db.job.count();
      return NextResponse.json({ heldRequestFinished: true, jobs });
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      throw err;
    }
  }
  return NextResponse.json({ error: 'Test hold timed out' }, { status: 504 });
}
