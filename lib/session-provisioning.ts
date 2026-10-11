/** Serializes pool admission and eviction without holding the lock for request lifetime.
 * Always releases after callback failure, and hands the next caller the gate.
 */
export function createAsyncGate() {
  let tail: Promise<void> = Promise.resolve();
  return async function runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const prior = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      return await work();
    } finally {
      release();
    }
  };
}
