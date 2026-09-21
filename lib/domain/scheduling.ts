/**
 * Crew scheduling primitives: double-booking detection and utilization.
 *
 * Overlap detection is a standard interval-scheduling sweep — sort by start
 * time, walk the list, and flag any assignment that starts before the
 * previous one for the same worker ends. Utilization is engaged hours over
 * available hours for the period, computed on demand rather than cached, so
 * it never goes stale relative to the underlying assignments.
 */

export interface Assignment {
  id: string;
  workerId: string;
  jobId: string;
  start: Date;
  end: Date;
}

export interface OverlapConflict {
  workerId: string;
  first: Assignment;
  second: Assignment;
}

/**
 * Finds every pair of assignments for the same worker whose time ranges
 * intersect. Assignments for different workers never conflict with each
 * other here — cross-job equipment conflicts are handled separately in
 * lib/domain/equipment.ts.
 */
export function findOverlaps(assignments: Assignment[]): OverlapConflict[] {
  const byWorker = new Map<string, Assignment[]>();

  for (const assignment of assignments) {
    const list = byWorker.get(assignment.workerId) ?? [];
    list.push(assignment);
    byWorker.set(assignment.workerId, list);
  }

  const conflicts: OverlapConflict[] = [];

  for (const [workerId, list] of byWorker) {
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (next.start.getTime() < current.end.getTime()) {
        conflicts.push({ workerId, first: current, second: next });
      }
    }
  }

  return conflicts;
}

export interface UtilizationInput {
  assignments: Assignment[];
  periodStart: Date;
  periodEnd: Date;
  /** Standard working hours available per calendar day in the period. Defaults to 8. */
  availableHoursPerDay?: number;
}

/**
 * Utilization = engaged hours in the period / available hours in the period.
 * Engaged hours are the portion of each assignment that actually falls
 * inside the period, so a job spanning the period boundary is only counted
 * for the days it overlaps. Reported as a 0–1 fraction; the UI formats it as
 * a percentage. Real construction-equipment utilization commonly runs
 * 35–65%, well below a factory floor, because of mobilization time and
 * weather — a number outside that range on the dashboard is worth a second
 * look, not necessarily a bug.
 */
export function calculateUtilization(input: UtilizationInput): number {
  const { assignments, periodStart, periodEnd } = input;
  const hoursPerDay = input.availableHoursPerDay ?? 8;

  const periodDays = Math.max(
    0,
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const availableHours = periodDays * hoursPerDay;
  if (availableHours === 0) return 0;

  let engagedHours = 0;
  for (const assignment of assignments) {
    const overlapStart = Math.max(assignment.start.getTime(), periodStart.getTime());
    const overlapEnd = Math.min(assignment.end.getTime(), periodEnd.getTime());
    if (overlapEnd > overlapStart) {
      engagedHours += (overlapEnd - overlapStart) / (1000 * 60 * 60);
    }
  }

  return Math.min(1, engagedHours / availableHours);
}
