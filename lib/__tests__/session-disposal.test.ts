import assert from 'node:assert/strict';
import { disconnectThenRemove } from '../session-disposal';

async function main() {
  const steps: string[] = [];
  let finishDisconnect!: () => void;
  const barrier = new Promise<void>((resolve) => { finishDisconnect = resolve; });
  const work = disconnectThenRemove(
    async () => { steps.push('disconnect-start'); await barrier; steps.push('disconnect-end'); },
    async () => { steps.push('remove'); },
  );
  assert.deepEqual(steps, ['disconnect-start'], 'removal must wait for disconnect');
  finishDisconnect();
  await work;
  assert.deepEqual(steps, ['disconnect-start', 'disconnect-end', 'remove']);

  let removed = false;
  await assert.rejects(
    disconnectThenRemove(async () => { throw new Error('disconnect failure'); }, async () => { removed = true; }),
    /disconnect failure/,
  );
  assert.equal(removed, false, 'a failed disconnect must preserve the database file');
  console.log('PASS session disposal ordering and disconnect failure safety');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
