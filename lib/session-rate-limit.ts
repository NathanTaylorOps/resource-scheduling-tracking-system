/** Best-effort, single-process demo session creation throttle.
 * Expired buckets are removed so distinct historical IPs do not accumulate
 * indefinitely in a long-running middleware process.
 */
export function recordSessionCreation(
  buckets: Map<string, number[]>,
  ip: string,
  now: number,
  maxCreations: number,
  windowMs: number,
): boolean {
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((t) => now - t >= 0 && now - t < windowMs);
    if (recent.length === 0) buckets.delete(key);
    else if (recent.length !== timestamps.length) buckets.set(key, recent);
  }
  const recent = buckets.get(ip) ?? [];
  if (recent.length >= maxCreations) return false;
  buckets.set(ip, [...recent, now]);
  return true;
}
