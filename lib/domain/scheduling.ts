/**
 * Crew scheduling primitives: double-booking detection and utilization.
 *
 * Overlap detection checks every pair of a worker's assignments for a
 * genuine time-range intersection, then asks whether that intersection is
 * actually a conflict — see isConcurrentOversightRole below for why those
 * are two different questions. Utilization is engaged hours over available
 * hours for the period, computed on demand rather than cached, so it never
 * goes stale relative to the underlying assignments.
 */

export interface Assignment {
  id: string;
  workerId: string;
  jobId: string;
  roleOnJob: string;
  start: Date;
  end: Date;
}

export interface OverlapConflict {
  workerId: string;
  first: Assignment;
  second: Assignment;
}

/**
 * Roles whose assignment window means "this job is under their purview
 * during this stretch," not "they're physically on site the whole time." A
 * Project Manager at a company Coastwood's size runs a portfolio of jobs at
 * once — checking in, coordinating subs and inspections, tracking budgets —
 * and being the named PM on two jobs over the same weeks is simply how that
 * role works, not a scheduling mistake. Every other role on the roster,
 * including the Site Superintendent, means hands-on or embedded presence:
 * at this company size the Super is the day-to-day supervisor for one
 * active site rather than a roaming portfolio role the way the PM is, so
 * two overlapping Superintendent (or Carpenter, or any trade) assignments
 * are a real double-booking — that crew member genuinely cannot be in both
 * places.
 *
 * Scoped to 'Project Manager' specifically rather than every plausibly-
 * supervisory title because that's the role the current roster actually
 * spans jobs with — extend this set if a future role needs the same
 * treatment, rather than guessing ahead of any assignment that exercises it.
 *
 * Keyed off Assignment.roleOnJob rather than Worker.trade, because it's the
 * per-assignment role that governs what a given stretch of time actually
 * commits the worker to — the same free-text field findUnfilledRoles
 * already treats as the authoritative role-on-this-job descriptor.
 */
const CONCURRENT_OVERSIGHT_ROLES = new Set(['Project Manager']);

export function isConcurrentOversightRole(roleOnJob: string): boolean {
  return CONCURRENT_OVERSIGHT_ROLES.has(roleOnJob);
}

/**
 * Finds every pair of assignments for the same worker whose time ranges
 * intersect and whose roles make that intersection a real conflict.
 * Assignments for different workers never conflict with each other here —
 * cross-job equipment conflicts are handled separately in
 * lib/domain/equipment.ts.
 *
 * Compares every pair for a worker, not just neighbors in start-time order.
 * Sorting by start and only checking adjacent pairs misses a genuine overlap
 * when a shorter assignment is nested inside a longer one — e.g. a one-week
 * job sandwiched inside a five-month PM stretch is two steps away from that
 * PM stretch once everything is sorted by start, so a neighbors-only sweep
 * never compares them. A single worker's assignment count is always small,
 * so the O(n^2) this requires costs nothing worth optimizing away.
 *
 * A pair is only reported as a conflict when at least one side is not a
 * concurrent-oversight role (see isConcurrentOversightRole) — two
 * overlapping oversight-role assignments, like a PM running two jobs at
 * once, are the normal shape of that role, not a conflict.
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
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const overlaps = a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
        if (!overlaps) continue;

        if (isConcurrentOversightRole(a.roleOnJob) && isConcurrentOversightRole(b.roleOnJob)) continue;

        const [first, second] = a.start.getTime() <= b.start.getTime() ? [a, b] : [b, a];
        conflicts.push({ workerId, first, second });
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

export interface RoleRequirement {
  id: string;
  roleOrTrade: string;
  requiredCount: number;
}

export interface RoleAssignment {
  roleOnJob: string;
}

/**
 * Requirements a job's current assignments don't satisfy — matched by exact
 * role/trade string, the same way a real staffing plan names a role rather
 * than fuzzy-matching a trade category. Returns the unmet requirements
 * themselves rather than a bare boolean, so the caller can name what's
 * missing on the page, the same way a scheduling conflict names who's
 * double-booked rather than just flagging that one exists.
 */
export function findUnfilledRoles(
  requirements: RoleRequirement[],
  assignments: RoleAssignment[],
): RoleRequirement[] {
  const countByRole = new Map<string, number>();
  for (const assignment of assignments) {
    countByRole.set(assignment.roleOnJob, (countByRole.get(assignment.roleOnJob) ?? 0) + 1);
  }

  return requirements.filter((requirement) => (countByRole.get(requirement.roleOrTrade) ?? 0) < requirement.requiredCount);
}
