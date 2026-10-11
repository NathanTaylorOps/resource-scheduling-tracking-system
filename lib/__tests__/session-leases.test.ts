import assert from 'node:assert/strict';
import { acquireSessionLease, eligibleForSessionDisposal } from '../session-leases';

async function main() {
  const entry = { activeLeases: 0, lastUsedAt: 100 };
  const releases: Array<() => void> = [];
  acquireSessionLease(entry, release => { releases.push(release); });
  acquireSessionLease(entry, release => { releases.push(release); });
  assert.equal(entry.activeLeases, 2);
  assert.equal(eligibleForSessionDisposal(entry, 20000, 1000), false, 'active work cannot be evicted');
  releases[0]();
  assert.equal(entry.activeLeases, 1);
  assert.equal(eligibleForSessionDisposal(entry, 20000, 1000), false);
  releases[0]();
  assert.equal(entry.activeLeases, 1, 'release must be idempotent');
  releases[1]();
  assert.equal(entry.activeLeases, 0);
  assert.equal(eligibleForSessionDisposal(entry, Date.now() + 2000, 1000), true);

  const failed = { activeLeases: 0, lastUsedAt: 0 };
  assert.throws(
    () => acquireSessionLease(failed, () => { throw new Error('request callback rejected'); }),
    /request callback rejected/,
  );
  assert.equal(failed.activeLeases, 0, 'failed registration must not leak a lease');
  console.log('PASS request leases protect active work and release correctly');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
