export interface SeedClock {
  daysFromNow: (days: number) => Date;
  daysAgo: (days: number) => Date;
}

export function createSeedClock(now = new Date()): SeedClock {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    daysFromNow: (days) => new Date(now.getTime() + days * dayMs),
    daysAgo: (days) => new Date(now.getTime() - days * dayMs),
  };
}
