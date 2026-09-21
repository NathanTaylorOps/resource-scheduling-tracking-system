/**
 * Standalone smoke test for the domain logic layer. Run with:
 *   npx tsx lib/domain/__tests__/domain.smoke.ts
 *
 * Not a substitute for a real test runner (Vitest is wired up once
 * `npm install` has run — see package.json) but this file has zero external
 * dependencies, so it can be executed immediately without installing
 * anything, and it exercises the numeric worked examples the design is
 * built around.
 */

import { getComplianceStatus, recordCompletion, earliestDue } from '../compliance';
import { computeDailyUsageRate, forecastDaysUntilDue, resolveHybridDueDate } from '../forecasting';
import { findOverlaps, calculateUtilization } from '../scheduling';
import { getCertificationStatus, canAssignWorker } from '../certifications';
import { applyCompletionToHierarchy, excludeCoveredChildren, type MaintenancePlan } from '../maintenance';
import { computeReadiness } from '../readiness';

let passed = 0;
let failed = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('compliance.ts — non-cumulative tolerance window');
{
  // The worked example this design is built on: a 100-hour inspection with a
  // 30-hour tolerance, completed at 130 hours (using the full grace window).
  const schedule = {
    unit: 'hours',
    intervalValue: 100,
    toleranceValue: 30,
    hardLimit: false,
    dueValue: 100,
  };

  const result = recordCompletion(schedule, 130);
  assertEqual('completed exactly at the tolerance edge is compliant', result.wasCompliant, true);
  assertEqual('tolerance consumed is the full 30 hours', result.toleranceConsumed, 30);
  // The critical assertion: next due is 200 (100 + 100, the fixed grid),
  // NOT 230 (130 + 100, which would drift the schedule later every cycle).
  assertEqual('next due advances on the fixed grid, not from completion time', result.updatedSchedule.dueValue, 200);

  const late = recordCompletion(schedule, 135);
  assertEqual('completed past the tolerance edge is non-compliant', late.wasCompliant, false);

  const hard = recordCompletion({ ...schedule, hardLimit: true }, 105);
  assertEqual('hard-limit items get no grace even 5 units over', hard.wasCompliant, false);

  const status = getComplianceStatus(schedule, 85, 20);
  assertEqual('due-soon window catches an item 15 units out with a 20-unit window', status.status, 'due_soon');

  const overdueStatus = getComplianceStatus(schedule, 135, 20);
  assertEqual('an item past the tolerance ceiling reads as overdue', overdueStatus.status, 'overdue');

  const multiCounter = earliestDue(
    [
      { schedule: { unit: 'hours', intervalValue: 500, toleranceValue: 50, hardLimit: false, dueValue: 500 }, currentValue: 480 },
      { schedule: { unit: 'days', intervalValue: 365, toleranceValue: 0, hardLimit: true, dueValue: 365 }, currentValue: 10 },
    ],
    30,
  );
  assertEqual('whichever-comes-first picks the hours counter over the calendar counter', multiCounter?.schedule.unit, 'hours');
}

console.log('\nforecasting.ts — utilization-based next-due projection');
{
  const rate = computeDailyUsageRate([
    { date: new Date('2026-08-01'), counterValue: 3000 },
    { date: new Date('2026-09-01'), counterValue: 3040 },
  ]);
  assertEqual('40 hours over 31 days is roughly 1.29 hours/day', Math.round(rate * 100) / 100, 1.29);

  const daysOut = forecastDaysUntilDue(3500, 3380, 40 / 31);
  assertEqual('120 hours remaining at ~1.29 hrs/day is roughly 93 days out', Math.round(daysOut!), 93);

  const idleForecast = forecastDaysUntilDue(3500, 3380, 0);
  assertEqual('an idle asset (zero usage rate) has no usage-based forecast', idleForecast, null);

  const hybridDue = resolveHybridDueDate(new Date('2027-01-01'), 30, new Date('2026-09-20'));
  assertEqual('hybrid trigger picks the usage projection when it comes first', hybridDue.toISOString().slice(0, 10), '2026-10-20');
}

console.log('\nscheduling.ts — overlap detection and utilization');
{
  const conflicts = findOverlaps([
    { id: 'a1', workerId: 'w1', jobId: 'j1', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
    { id: 'a2', workerId: 'w1', jobId: 'j2', start: new Date('2026-09-22T14:00'), end: new Date('2026-09-22T18:00') },
    { id: 'a3', workerId: 'w2', jobId: 'j1', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
  ]);
  assertEqual('overlapping assignments for the same worker are flagged', conflicts.length, 1);
  assertEqual('different workers on the same hours are not a conflict', conflicts.some((c) => c.workerId === 'w2'), false);

  const utilization = calculateUtilization({
    assignments: [
      { id: 'a1', workerId: 'w1', jobId: 'j1', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
    ],
    periodStart: new Date('2026-09-22T00:00'),
    periodEnd: new Date('2026-09-23T00:00'),
    availableHoursPerDay: 8,
  });
  assertEqual('a full 8-hour day of assignment against an 8-hour day is 100% utilized', utilization, 1);
}

console.log('\ncertifications.ts — expiry status and assignment gating');
{
  const now = new Date('2026-09-20');
  const status = getCertificationStatus(new Date('2026-10-05'), now);
  assertEqual('a cert expiring in 15 days is expiring_soon', status.status, 'expiring_soon');
  assertEqual('crossed threshold is the 30-day tier', status.crossedThreshold, 30);

  const eligibility = canAssignWorker(
    ['confined_space', 'first_aid'],
    [{ certType: 'confined_space', expiryDate: new Date('2027-01-01') }],
    now,
  );
  assertEqual('missing a required cert blocks the assignment', eligibility.eligible, false);
  assertEqual('the missing cert is named', eligibility.missingOrExpired, ['first_aid']);
}

console.log('\nmaintenance.ts — nested PM hierarchy');
{
  const parent: MaintenancePlan = {
    id: 'plan-90',
    equipmentId: 'eq-1',
    parentPlanId: null,
    schedule: { unit: 'days', intervalValue: 90, toleranceValue: 7, hardLimit: false, dueValue: 90 },
  };
  const child: MaintenancePlan = {
    id: 'plan-30',
    equipmentId: 'eq-1',
    parentPlanId: 'plan-90',
    schedule: { unit: 'days', intervalValue: 30, toleranceValue: 3, hardLimit: false, dueValue: 90 },
  };

  const result = applyCompletionToHierarchy(parent, [parent, child], 90);
  assertEqual('completing the 90-day service also advances the nested 30-day plan', result.suppressedChildren.length, 1);
  assertEqual('the suppressed child does not get a separate, duplicate due date', result.suppressedChildren[0].updatedSchedule.dueValue, 120);

  const duePlans = excludeCoveredChildren([parent, child], [parent, child]);
  assertEqual('the due-soon list shows the parent only, not a duplicate child line', duePlans.map((p) => p.id), ['plan-90']);
}

console.log('\nreadiness.ts — composite decomposable score');
{
  const readiness = computeReadiness({ crew: 'ok', equipment: 'warning', compliance: 'ok', weather: 'ok' });
  assertEqual('overall status is the worst of the four components', readiness.overall, 'warning');

  const blocked = computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'blocked', weather: 'warning' });
  assertEqual('a single blocked component blocks the whole job', blocked.overall, 'blocked');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
