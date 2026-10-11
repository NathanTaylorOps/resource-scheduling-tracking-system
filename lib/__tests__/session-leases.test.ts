import assert from 'node:assert/strict';
import { acquireSessionLease, eligibleForSessionDisposal, selectCapacityEvictionCandidate } from '../session-leases';

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
  const capacityPool = new Map([
    ['active-oldest', { activeLeases: 2, lastUsedAt: 1 }],
    ['idle-middle', { activeLeases: 0, lastUsedAt: 3 }],
    ['idle-newest', { activeLeases: 0, lastUsedAt: 8 }],
  ]);
  assert.equal(selectCapacityEvictionCandidate(capacityPool), 'idle-middle',
    'an active request may not be chosen even if its session is oldest');
  capacityPool.get('idle-middle')!.activeLeases = 1;
  capacityPool.get('idle-newest')!.activeLeases = 1;
  assert.equal(selectCapacityEvictionCandidate(capacityPool), undefined,
    'fully leased pool must refuse eviction');
  capacityPool.get('active-oldest')!.activeLeases = 0;
  assert.equal(selectCapacityEvictionCandidate(capacityPool), 'active-oldest',
    'completed requests become eligible after lease release');
  console.log('PASS request leases protect active work and release correctly');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
