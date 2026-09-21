/**
 * Standalone smoke test for the domain logic layer. Run with:
 *   npx tsx lib/domain/__tests__/domain.smoke.ts
 *
 * Not a substitute for a real test runner, but this file has zero external
 * dependencies, so it can be executed immediately without installing
 * anything, and it exercises the numeric worked examples the design is
 * built around.
 */

import { getComplianceStatus, recordCompletion, earliestDue } from '../compliance';
import { computeDailyUsageRate, forecastDaysUntilDue, resolveHybridDueDate, bucketForecast } from '../forecasting';
import { findOverlaps, calculateUtilization, findUnfilledRoles } from '../scheduling';
import { getCertificationStatus, canAssignWorker } from '../certifications';
import { applyCompletionToHierarchy, excludeCoveredChildren, type MaintenancePlan } from '../maintenance';
import { computeReadiness, permitsStatusFrom } from '../readiness';
import { custodyUpdateFor } from '../custody';
import { findEquipmentConflicts } from '../equipment';
import { evaluateSubcontractorCompliance } from '../subcontractors';

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

  const now = new Date('2026-09-20');
  assertEqual('a due date 10 days out buckets into 0-30', bucketForecast(new Date('2026-09-30'), now), '0-30');
  assertEqual('a due date 45 days out buckets into 31-60', bucketForecast(new Date('2026-11-04'), now), '31-60');
  assertEqual('a due date 75 days out buckets into 61-90', bucketForecast(new Date('2026-12-04'), now), '61-90');
  assertEqual('a due date 120 days out buckets into beyond', bucketForecast(new Date('2027-01-18'), now), 'beyond');
}

console.log('\nscheduling.ts — overlap detection, utilization, and role coverage');
{
  const conflicts = findOverlaps([
    { id: 'a1', workerId: 'w1', jobId: 'j1', roleOnJob: 'Carpenter', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
    { id: 'a2', workerId: 'w1', jobId: 'j2', roleOnJob: 'Carpenter', start: new Date('2026-09-22T14:00'), end: new Date('2026-09-22T18:00') },
    { id: 'a3', workerId: 'w2', jobId: 'j1', roleOnJob: 'Carpenter', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
  ]);
  assertEqual('overlapping assignments for the same worker are flagged', conflicts.length, 1);
  assertEqual('different workers on the same hours are not a conflict', conflicts.some((c) => c.workerId === 'w2'), false);

  // A Project Manager at this company size runs several jobs' worth of
  // oversight at once — two overlapping PM assignments are how that role
  // normally looks, not a double-booking (this is the crew-readiness false
  // positive real PMs like Kenji and Renee used to trip on every job they
  // managed concurrently).
  const pmOverlap = findOverlaps([
    { id: 'p1', workerId: 'pm1', jobId: 'j1', roleOnJob: 'Project Manager', start: new Date('2026-09-01'), end: new Date('2026-12-01') },
    { id: 'p2', workerId: 'pm1', jobId: 'j2', roleOnJob: 'Project Manager', start: new Date('2026-10-01'), end: new Date('2027-01-01') },
  ]);
  assertEqual('two overlapping Project Manager assignments for the same PM are not a conflict', pmOverlap.length, 0);

  // But a PM stretch overlapping a hands-on assignment for the same worker
  // still means physically being in two places — only a pair where BOTH
  // sides are oversight roles is exempt.
  const mixedOverlap = findOverlaps([
    { id: 'm1', workerId: 'w3', jobId: 'j1', roleOnJob: 'Project Manager', start: new Date('2026-09-01'), end: new Date('2026-12-01') },
    { id: 'm2', workerId: 'w3', jobId: 'j2', roleOnJob: 'Carpenter', start: new Date('2026-10-01'), end: new Date('2026-10-15') },
  ]);
  assertEqual('an oversight assignment overlapping a hands-on assignment for the same worker is still a conflict', mixedOverlap.length, 1);

  // The old adjacent-pairs-only sweep sorted by start and only ever compared
  // neighbors, so a short assignment nested inside a longer one for the same
  // worker was never checked against it once a third assignment sorted
  // between them. w4 here has a five-month stretch (n1), a short job fully
  // inside it (n2), and another short job that starts after n2 ends but is
  // still inside n1 (n3) — sorted by start this is n1, n2, n3, so a
  // neighbors-only sweep checks n1-n2 and n2-n3 but never n1-n3, even though
  // n1 and n3 genuinely overlap. n2 and n3 themselves don't overlap each
  // other (n2 ends 2026-09-20, n3 starts 2026-10-01), so the correct total
  // is exactly two conflicts — n1-n2 and n1-n3 — not three.
  const nestedOverlap = findOverlaps([
    { id: 'n1', workerId: 'w4', jobId: 'j1', roleOnJob: 'Carpenter', start: new Date('2026-09-01'), end: new Date('2027-02-01') },
    { id: 'n2', workerId: 'w4', jobId: 'j2', roleOnJob: 'Carpenter', start: new Date('2026-09-10'), end: new Date('2026-09-20') },
    { id: 'n3', workerId: 'w4', jobId: 'j3', roleOnJob: 'Carpenter', start: new Date('2026-10-01'), end: new Date('2026-10-10') },
  ]);
  assertEqual('a non-adjacent nested overlap (n1-n3) is caught, alongside the neighbor pair n1-n2, and nothing else', nestedOverlap.length, 2);
  assertEqual(
    'the nested pair (n1-n3) specifically is among the conflicts, not just the neighbor pair n1-n2',
    nestedOverlap.some((c) => (c.first.id === 'n1' && c.second.id === 'n3') || (c.first.id === 'n3' && c.second.id === 'n1')),
    true,
  );

  const utilization = calculateUtilization({
    assignments: [
      { id: 'a1', workerId: 'w1', jobId: 'j1', roleOnJob: 'Carpenter', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-22T16:00') },
    ],
    periodStart: new Date('2026-09-22T00:00'),
    periodEnd: new Date('2026-09-23T00:00'),
    availableHoursPerDay: 8,
  });
  assertEqual('a full 8-hour day of assignment against an 8-hour day is 100% utilized', utilization, 1);

  const roleCoverage = findUnfilledRoles(
    [
      { id: 'r1', roleOrTrade: 'Licensed Electrician', requiredCount: 1 },
      { id: 'r2', roleOrTrade: 'Carpenter', requiredCount: 2 },
    ],
    [{ roleOnJob: 'Carpenter' }, { roleOnJob: 'Carpenter' }],
  );
  assertEqual('a role with zero assignments is unfilled', roleCoverage.map((r) => r.id), ['r1']);
  assertEqual('a role staffed to its required count is not returned', roleCoverage.some((r) => r.roleOrTrade === 'Carpenter'), false);

  const partialCoverage = findUnfilledRoles(
    [{ id: 'r3', roleOrTrade: 'Carpenter', requiredCount: 2 }],
    [{ roleOnJob: 'Carpenter' }],
  );
  assertEqual('a role short of its required count is still unfilled, even with one assignment on it', partialCoverage.length, 1);

  const fuzzyMismatch = findUnfilledRoles(
    [{ id: 'r4', roleOrTrade: 'Electrician', requiredCount: 1 }],
    [{ roleOnJob: 'Licensed Electrician' }],
  );
  assertEqual('roleOnJob is matched by exact string, not fuzzy trade matching', fuzzyMismatch.length, 1);
}

console.log('\nequipment.ts — cross-job reservation conflicts');
{
  const equipmentConflicts = findEquipmentConflicts([
    { id: 'res1', equipmentId: 'eq-skidsteer', jobId: 'job-cedar-hollow', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-26T17:00') },
    { id: 'res2', equipmentId: 'eq-skidsteer', jobId: 'job-orchard-ridge', start: new Date('2026-09-25T08:00'), end: new Date('2026-09-29T17:00') },
    { id: 'res3', equipmentId: 'eq-excavator', jobId: 'job-cedar-hollow', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-26T17:00') },
  ]);
  assertEqual('overlapping reservations for the same asset are flagged', equipmentConflicts.length, 1);
  assertEqual('the conflict is keyed to the asset that is double-booked', equipmentConflicts[0]?.equipmentId, 'eq-skidsteer');
  assertEqual('a different asset reserved over the same window is not a conflict', equipmentConflicts.some((c) => c.equipmentId === 'eq-excavator'), false);

  const backToBack = findEquipmentConflicts([
    { id: 'res4', equipmentId: 'eq-generator', jobId: 'job-cedar-hollow', start: new Date('2026-09-22T08:00'), end: new Date('2026-09-24T17:00') },
    { id: 'res5', equipmentId: 'eq-generator', jobId: 'job-lakeview', start: new Date('2026-09-24T17:00'), end: new Date('2026-09-26T17:00') },
  ]);
  assertEqual('back-to-back reservations that just touch, not overlap, are not a conflict', backToBack.length, 0);
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

  // --- renewal patterns: one expiryDate field, four different real shapes ---

  const defaultPattern = getCertificationStatus(new Date('2026-09-01'), now);
  assertEqual('no renewalPattern given defaults to HARD_EXPIRY (unchanged prior behavior)', defaultPattern.status, 'expired');

  const hardExpiry = getCertificationStatus(new Date('2026-09-01'), now, undefined, 'HARD_EXPIRY');
  assertEqual('HARD_EXPIRY past its date reads as a real expired, not a softer status', hardExpiry.status, 'expired');

  const licenseCycle = getCertificationStatus(new Date('2026-09-01'), now, undefined, 'LICENSE_CYCLE');
  assertEqual('LICENSE_CYCLE behaves like HARD_EXPIRY — a state license clock is still a real wall', licenseCycle.status, 'expired');

  const informalPastWindow = getCertificationStatus(new Date('2026-09-01'), now, undefined, 'INFORMAL_RECENCY');
  assertEqual('INFORMAL_RECENCY past its informal window reads as aging, not expired', informalPastWindow.status, 'aging');

  const informalStillCurrent = getCertificationStatus(new Date('2027-01-01'), now, undefined, 'INFORMAL_RECENCY');
  assertEqual('INFORMAL_RECENCY well within its window is still valid', informalStillCurrent.status, 'valid');

  const graceFiledOnTime = getCertificationStatus(
    new Date('2026-09-01'),
    now,
    undefined,
    'GRACE_PERIOD',
    new Date('2026-05-01'), // filed well over 90 days before the 2026-09-01 expiry
  );
  assertEqual('GRACE_PERIOD filed on time stays valid-but-pending past its nominal expiry', graceFiledOnTime.status, 'renewal_pending');

  const graceFiledLate = getCertificationStatus(
    new Date('2026-09-01'),
    now,
    undefined,
    'GRACE_PERIOD',
    new Date('2026-08-20'), // filed under 90 days before expiry — too late for the grace rule
  );
  assertEqual('GRACE_PERIOD filed too close to expiry is a plain expired, not renewal_pending', graceFiledLate.status, 'expired');

  const graceNeverFiled = getCertificationStatus(new Date('2026-09-01'), now, undefined, 'GRACE_PERIOD');
  assertEqual('GRACE_PERIOD with no renewal on file at all is a plain expired', graceNeverFiled.status, 'expired');

  const agingEligibility = canAssignWorker(
    ['osha_10'],
    [{ certType: 'osha_10', expiryDate: new Date('2026-09-01'), renewalPattern: 'INFORMAL_RECENCY' }],
    now,
  );
  assertEqual('an aging (not expired) cert does not block assignment — the card is still legally held', agingEligibility.eligible, true);

  const renewalPendingEligibility = canAssignWorker(
    ['epa_rrp'],
    [{ certType: 'epa_rrp', expiryDate: new Date('2026-09-01'), renewalPattern: 'GRACE_PERIOD', renewalFiledDate: new Date('2026-05-01') }],
    now,
  );
  assertEqual('a renewal-pending cert does not block assignment — EPA RRP keeps it valid while pending', renewalPendingEligibility.eligible, true);

  const trueExpiredEligibility = canAssignWorker(
    ['epa_rrp'],
    [{ certType: 'epa_rrp', expiryDate: new Date('2026-09-01'), renewalPattern: 'GRACE_PERIOD' }],
    now,
  );
  assertEqual('a genuinely expired cert still blocks assignment regardless of pattern', trueExpiredEligibility.eligible, false);

  // Two records for the same certType — the expired card being replaced,
  // still on file, plus the new one already issued. A worker who holds a
  // duplicate this way is eligible, whichever record happens to come first.
  const duplicateCertStaleFirst = canAssignWorker(
    ['confined_space'],
    [
      { certType: 'confined_space', expiryDate: new Date('2026-01-01') }, // expired
      { certType: 'confined_space', expiryDate: new Date('2027-01-01') }, // current
    ],
    now,
  );
  assertEqual('holding a current cert alongside an expired duplicate is eligible, even when the expired one is listed first', duplicateCertStaleFirst.eligible, true);

  const duplicateCertCurrentFirst = canAssignWorker(
    ['confined_space'],
    [
      { certType: 'confined_space', expiryDate: new Date('2027-01-01') }, // current
      { certType: 'confined_space', expiryDate: new Date('2026-01-01') }, // expired
    ],
    now,
  );
  assertEqual('the same duplicate cert reads as eligible regardless of which record is listed first', duplicateCertCurrentFirst.eligible, true);

  const duplicateCertAllExpired = canAssignWorker(
    ['confined_space'],
    [
      { certType: 'confined_space', expiryDate: new Date('2026-01-01') },
      { certType: 'confined_space', expiryDate: new Date('2026-02-01') },
    ],
    now,
  );
  assertEqual('a duplicate cert where every on-file record has expired still blocks assignment', duplicateCertAllExpired.eligible, false);
}

console.log('\nsubcontractors.ts — entity-level COI and license compliance');
{
  const now = new Date('2026-09-20');

  const allCurrent = evaluateSubcontractorCompliance(
    {
      licenseExpiryDate: new Date('2027-06-01'),
      coiRecords: [
        { coverageType: 'GENERAL_LIABILITY', expiryDate: new Date('2027-01-01') },
        { coverageType: 'WORKERS_COMP', expiryDate: new Date('2027-01-01') },
      ],
    },
    now,
  );
  assertEqual('a subcontractor with a current license and current COI has no compliance issue', allCurrent.hasExpiredItem, false);
  assertEqual('and no expiring-soon flag either, this far out', allCurrent.hasExpiringSoonItem, false);

  const expiredCoi = evaluateSubcontractorCompliance(
    {
      licenseExpiryDate: new Date('2027-06-01'),
      coiRecords: [
        { coverageType: 'GENERAL_LIABILITY', expiryDate: new Date('2026-08-01') },
        { coverageType: 'WORKERS_COMP', expiryDate: new Date('2027-01-01') },
      ],
    },
    now,
  );
  assertEqual('one lapsed coverage line is enough to flag the whole firm as expired', expiredCoi.hasExpiredItem, true);
  assertEqual('the lapsed line is named by its coverage type', expiredCoi.credentials.find((c) => c.status === 'expired')?.label, 'GENERAL_LIABILITY');

  const expiredLicense = evaluateSubcontractorCompliance(
    { licenseExpiryDate: new Date('2026-01-01'), coiRecords: [] },
    now,
  );
  assertEqual('an expired trade license alone flags the firm, with no COI records at all', expiredLicense.hasExpiredItem, true);

  const noRecordsOnFile = evaluateSubcontractorCompliance({ licenseExpiryDate: null, coiRecords: [] }, now);
  assertEqual('no license or COI on file is a data gap, not an asserted compliance failure', noRecordsOnFile.hasExpiredItem, false);
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
  const readiness = computeReadiness({ crew: 'ok', equipment: 'warning', compliance: 'ok', weather: 'ok', permits: 'ok' });
  assertEqual('overall status is the worst of the five components', readiness.overall, 'warning');

  const blocked = computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'blocked', weather: 'warning', permits: 'ok' });
  assertEqual('a single blocked component blocks the whole job', blocked.overall, 'blocked');

  const permitBlocked = computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'ok', weather: 'ok', permits: 'blocked' });
  assertEqual('a blocked permits component blocks the job exactly like any other component', permitBlocked.overall, 'blocked');

  assertEqual(
    'a failed inspection blocks regardless of permit or other-inspection standing',
    permitsStatusFrom({ hasFailedInspection: true, hasExpiredPermit: false, hasInspectionDueSoon: false }),
    'blocked',
  );
  assertEqual(
    'an expired permit blocks even with no failed inspection',
    permitsStatusFrom({ hasFailedInspection: false, hasExpiredPermit: true, hasInspectionDueSoon: false }),
    'blocked',
  );
  assertEqual(
    'an inspection due soon warns, short of blocking',
    permitsStatusFrom({ hasFailedInspection: false, hasExpiredPermit: false, hasInspectionDueSoon: true }),
    'warning',
  );
  assertEqual(
    'no issues reads as ok',
    permitsStatusFrom({ hasFailedInspection: false, hasExpiredPermit: false, hasInspectionDueSoon: false }),
    'ok',
  );
}

console.log('\ncustody.ts — what a scan action does to custody and status');
{
  const checkOut = custodyUpdateFor({ action: 'CHECK_OUT', scannedByWorkerId: 'w-marcus', jobId: 'job-cedar-hollow' });
  assertEqual('check-out assigns the job and the scanning worker, and clears any yard note', checkOut, {
    currentJobId: 'job-cedar-hollow',
    currentWorkerId: 'w-marcus',
    locationNote: null,
    status: 'ACTIVE',
  });

  const checkIn = custodyUpdateFor({ action: 'CHECK_IN', scannedByWorkerId: 'w-marcus', locationNote: '  Yard — Bay 2  ' });
  assertEqual('check-in releases custody and files the trimmed location note', checkIn, {
    currentJobId: null,
    currentWorkerId: null,
    locationNote: 'Yard — Bay 2',
    status: 'IDLE',
  });

  const checkInNoNote = custodyUpdateFor({ action: 'CHECK_IN', scannedByWorkerId: 'w-marcus' });
  assertEqual('check-in with no note on hand still files a location — the yard', checkInNoNote.locationNote, 'Yard');

  const locationUpdate = custodyUpdateFor({ action: 'LOCATION_UPDATE', scannedByWorkerId: 'w-jules', locationNote: '  Bay 3  ' });
  assertEqual('a location update touches only the location note', locationUpdate, { locationNote: 'Bay 3' });

  const locationUpdateNoNote = custodyUpdateFor({ action: 'LOCATION_UPDATE', scannedByWorkerId: 'w-jules' });
  assertEqual('a location update with no note on hand degrades gracefully rather than throwing', locationUpdateNoNote.locationNote, undefined);

  const defect = custodyUpdateFor({ action: 'DEFECT_REPORTED', scannedByWorkerId: 'w-bigsam' });
  assertEqual('a defect report takes the asset down without moving it', defect, { status: 'DOWN_FOR_SERVICE' });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
