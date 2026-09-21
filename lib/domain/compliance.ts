/**
 * Equipment compliance scheduling — calibration, inspection, and service-life tracking.
 *
 * Construction fleet tools typically track a single counter (a calendar date or an
 * engine-hour meter) per asset. This module follows the practice used in aviation
 * maintenance-records management instead: a compliance item is governed by a fixed
 * interval on a nominal schedule "grid," with an explicit, non-cumulative tolerance
 * (grace) window, and an optional hard limit for safety-critical items that cannot
 * be exceeded under any circumstance.
 *
 * The rule that matters: due dates are always calculated forward from the due point
 * of the last completed cycle, never from the date the work actually happened. If
 * that were not true, a technician who used up grace time on one service would push
 * every future due date later by the same amount, and the schedule would drift
 * further from "actual" intervals with every deferred service. Anchoring to the
 * fixed grid keeps the interval honest over the life of the asset.
 */

export interface ComplianceSchedule {
  /** The counter this schedule runs on — calendar days, engine hours, load cycles, etc. */
  unit: string;
  /** Length of one service interval, expressed in `unit`. */
  intervalValue: number;
  /** Grace period beyond the nominal due point, expressed in `unit`. Ignored when hardLimit is true. */
  toleranceValue: number;
  /** Safety-critical items that may never be exceeded, regardless of tolerance. */
  hardLimit: boolean;
  /** The nominal due point of the next service on the fixed grid. */
  dueValue: number;
}

export type ComplianceStatus = 'ok' | 'due_soon' | 'in_tolerance' | 'overdue';

export interface ComplianceStatusResult {
  status: ComplianceStatus;
  /** Positive while before the nominal due point; negative once past it. */
  remainingToDue: number;
  /** The latest value at which this cycle can still be completed without going out of compliance. */
  allowedCeiling: number;
}

/**
 * Evaluates where a compliance item currently stands against its schedule.
 *
 * @param schedule       The item's interval/tolerance/hard-limit configuration.
 * @param currentValue   The asset's current counter reading (today's date, current hour meter, etc.).
 * @param dueSoonWindow  How close to the nominal due point counts as "due soon," in `unit`.
 */
export function getComplianceStatus(
  schedule: ComplianceSchedule,
  currentValue: number,
  dueSoonWindow: number,
): ComplianceStatusResult {
  const allowedCeiling = schedule.hardLimit
    ? schedule.dueValue
    : schedule.dueValue + schedule.toleranceValue;

  const remainingToDue = schedule.dueValue - currentValue;

  let status: ComplianceStatus;
  if (currentValue > allowedCeiling) {
    status = 'overdue';
  } else if (currentValue > schedule.dueValue) {
    status = 'in_tolerance';
  } else if (remainingToDue <= dueSoonWindow) {
    status = 'due_soon';
  } else {
    status = 'ok';
  }

  return { status, remainingToDue, allowedCeiling };
}

export interface CompletionResult {
  /** Whether the service was completed within the allowed window for this cycle. */
  wasCompliant: boolean;
  /** How much of the tolerance window was used, in `unit`. Zero if completed at or before the nominal due point. */
  toleranceConsumed: number;
  /** The updated schedule to persist — its dueValue has advanced by exactly one interval on the fixed grid. */
  updatedSchedule: ComplianceSchedule;
}

/**
 * Records a completed service event and advances the schedule.
 *
 * The new due point is always `dueValue + intervalValue` — the fixed grid advance —
 * never `completedAtValue + intervalValue`. This is what keeps a late (but
 * in-tolerance) service from permanently shifting every later cycle.
 */
export function recordCompletion(
  schedule: ComplianceSchedule,
  completedAtValue: number,
): CompletionResult {
  const allowedCeiling = schedule.hardLimit
    ? schedule.dueValue
    : schedule.dueValue + schedule.toleranceValue;

  const wasCompliant = completedAtValue <= allowedCeiling;
  const toleranceConsumed = Math.max(0, completedAtValue - schedule.dueValue);

  return {
    wasCompliant,
    toleranceConsumed,
    updatedSchedule: {
      ...schedule,
      dueValue: schedule.dueValue + schedule.intervalValue,
    },
  };
}

/**
 * For assets tracked on more than one counter at once (e.g. a generator on both
 * run-hours and calendar age), the asset is due at whichever counter trips first —
 * the same "whichever comes first" logic used for life-limited aircraft parts.
 *
 * Not called from the app today: EquipmentCompliance and MaintenancePlan
 * rows each govern exactly one counter (see schema.prisma), so a hybrid
 * requirement ("every 500 hours or 12 months, whichever comes first") isn't
 * representable as a single item yet — it would need two rows treated as
 * one, which the schema doesn't group. This is the primitive that
 * comparison would run on once that grouping exists; verified against its
 * own worked example below rather than deleted ahead of that modeling
 * decision. See README, "Known limitations / roadmap."
 */
export function earliestDue(
  schedules: Array<{ schedule: ComplianceSchedule; currentValue: number }>,
  dueSoonWindow: number,
): { schedule: ComplianceSchedule; result: ComplianceStatusResult } | null {
  if (schedules.length === 0) return null;

  let earliest: { schedule: ComplianceSchedule; result: ComplianceStatusResult } | null = null;

  for (const { schedule, currentValue } of schedules) {
    const result = getComplianceStatus(schedule, currentValue, dueSoonWindow);
    if (!earliest || result.remainingToDue < earliest.result.remainingToDue) {
      earliest = { schedule, result };
    }
  }

  return earliest;
}
