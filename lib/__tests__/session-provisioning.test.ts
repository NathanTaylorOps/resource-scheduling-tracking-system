import assert from 'node:assert/strict';
import { createAsyncGate } from '../session-provisioning';

async function main() {
  const gate = createAsyncGate();
  let created = 0;
  let registered: object | undefined;
  const get = () => gate(async () => {
    if (!registered) {
      await Promise.resolve();
      created++;
      registered = {};
    }
    return registered;
  });
  const results = await Promise.all(Array.from({ length: 40 }, () => get()));
  assert.equal(created, 1, 'parallel first callers must create only one resource');
  assert.ok(results.every((x) => x === registered));

  let occupied = 0;
  let peak = 0;
  const limited = createAsyncGate();
  await Promise.all(Array.from({ length: 75 }, () => limited(async () => {
    occupied++;
    peak = Math.max(occupied, peak);
    await Promise.resolve();
    occupied--;
  })));
  assert.equal(peak, 1, 'pool admission must not overlap');

  const failingGate = createAsyncGate();
  await assert.rejects(failingGate(async () => { throw new Error('failed creation'); }), /failed creation/);
  assert.equal(await failingGate(async () => 42), 42, 'failed provisioning must release the gate');
  console.log('PASS single-flight provisioning, serialized admission, failure release');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
