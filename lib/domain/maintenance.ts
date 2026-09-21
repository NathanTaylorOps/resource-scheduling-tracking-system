/**
 * Nested preventive-maintenance hierarchy.
 *
 * When a smaller inspection's scope is fully contained inside a larger one
 * (a 30-day check folded into a 90-day check), completing the larger one
 * should satisfy the smaller one for that cycle too — otherwise the same
 * asset generates two work orders for work that was really done once. This
 * mirrors how aviation "letter checks" nest: each larger check incorporates
 * everything the smaller, more frequent ones cover.
 *
 * A plan qualifies as nested under a parent when its interval divides evenly
 * into the parent's interval on the same unit — e.g. a 30-day plan nests
 * under a 90-day plan (90 / 30 = 3), but a 45-day plan does not nest cleanly
 * under a 90-day plan on a shared due date and is left to run independently.
 */

import { ComplianceSchedule, recordCompletion } from './compliance';

export interface MaintenancePlan {
  id: string;
  equipmentId: string;
  parentPlanId: string | null;
  schedule: ComplianceSchedule;
}

/**
 * True when completing `parent` on `parentCompletedAtValue` also covers
 * `child` for this cycle — i.e. the two are due at the same point on the
 * grid and the child's interval nests evenly inside the parent's.
 */
export function isChildCoveredByParent(
  child: MaintenancePlan,
  parent: MaintenancePlan,
  parentCompletedAtValue: number,
): boolean {
  if (child.parentPlanId !== parent.id) return false;
  if (child.schedule.unit !== parent.schedule.unit) return false;

  const nestsEvenly = parent.schedule.intervalValue % child.schedule.intervalValue === 0;
  const dueSameCycle = child.schedule.dueValue === parent.schedule.dueValue;

  return nestsEvenly && dueSameCycle && parentCompletedAtValue >= child.schedule.dueValue;
}

export interface HierarchyCompletionResult {
  parentPlanId: string;
  updatedParent: ComplianceSchedule;
  suppressedChildren: Array<{ planId: string; updatedSchedule: ComplianceSchedule }>;
}

/**
 * Applies a completed parent-level service to its plan and, for every child
 * plan it covers this cycle, advances the child's schedule too instead of
 * leaving a stale duplicate work order on the calendar. Returns the updated
 * schedules to persist for the parent and each suppressed child.
 */
export function applyCompletionToHierarchy(
  parent: MaintenancePlan,
  allPlans: MaintenancePlan[],
  completedAtValue: number,
): HierarchyCompletionResult {
  const parentResult = recordCompletion(parent.schedule, completedAtValue);

  const children = allPlans.filter((p) => p.parentPlanId === parent.id);
  const suppressedChildren = children
    .filter((child) => isChildCoveredByParent(child, parent, completedAtValue))
    .map((child) => ({
      planId: child.id,
      updatedSchedule: recordCompletion(child.schedule, completedAtValue).updatedSchedule,
    }));

  return {
    parentPlanId: parent.id,
    updatedParent: parentResult.updatedSchedule,
    suppressedChildren,
  };
}

/**
 * Filters a due-soon list so a child plan already covered by an
 * about-to-fire parent doesn't appear as a second, duplicate line item.
 *
 * Deliberately its own check rather than a call to isChildCoveredByParent
 * above: that function answers "did completing the parent just now cover
 * this child," which needs an actual completedAtValue from a real
 * completion event. This one answers a display-time question with no
 * completion in hand yet — "are the parent and child nominally due the same
 * cycle" — so the two can't share a call, only the nesting rule itself,
 * which is why it's re-checked here rather than re-derived differently.
 * That rule includes the same unit guard isChildCoveredByParent has: a
 * child and parent on different counters (one on CALENDAR_DAYS, say, the
 * other on RUN_HOURS) can never nest, whatever their raw interval/due
 * numbers happen to be, since those numbers aren't measuring the same
 * thing.
 */
export function excludeCoveredChildren(
  duePlans: MaintenancePlan[],
  allPlans: MaintenancePlan[],
): MaintenancePlan[] {
  return duePlans.filter((plan) => {
    if (!plan.parentPlanId) return true;
    const parent = allPlans.find((p) => p.id === plan.parentPlanId);
    if (!parent) return true;
    if (plan.schedule.unit !== parent.schedule.unit) return true;
    // If the parent is due the same cycle and nests this child evenly,
    // the parent's own work order will cover it — leave it off the list.
    const nestsEvenly = parent.schedule.intervalValue % plan.schedule.intervalValue === 0;
    return !(nestsEvenly && parent.schedule.dueValue === plan.schedule.dueValue);
  });
}
