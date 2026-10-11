/**
 * A request-scoped lease keeps a pooled database client ineligible for
 * eviction until Next.js reports that its response work has finished.
 */
export interface LeaseEntry {
  activeLeases: number;
  lastUsedAt: number;
}

export function acquireSessionLease<T extends LeaseEntry>(
  entry: T,
  registerRequestCompletion: (release: () => void) => void,
): void {
  entry.activeLeases += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.activeLeases -= 1;
    entry.lastUsedAt = Date.now();
  };
  try {
    registerRequestCompletion(release);
  } catch (error) {
    release();
    throw error;
  }
}

export function eligibleForSessionDisposal(
  entry: LeaseEntry,
  now: number,
  idleTimeoutMs: number,
): boolean {
  return entry.activeLeases === 0 && now - entry.lastUsedAt > idleTimeoutMs;
}

/** Only unleased clients are eligible for capacity eviction. */
export function selectCapacityEvictionCandidate<T extends LeaseEntry>(
  entries: Map<string, T>,
): string | undefined {
  let chosen: string | undefined;
  let oldest = Infinity;
  for (const [id, entry] of entries) {
    if (entry.activeLeases !== 0) continue;
    if (entry.lastUsedAt < oldest) {
      chosen = id;
      oldest = entry.lastUsedAt;
    }
  }
  return chosen;
}
