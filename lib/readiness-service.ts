/**
 * Wires the pure domain logic in lib/domain to live Prisma data. The bulk of
 * this file is computeJobReadiness, which turns "what's in the database
 * right now" into the five-part readiness breakdown shown on the dashboard
 * and the job detail page.
 *
 * Crew and equipment readiness are checked against an explicit staffing
 * plan and forward equipment bookings (JobRoleRequirement, EquipmentReservation),
 * not just inferred from who happens to be assigned or parked on site —
 * see the crew-and-equipment-requirements note in the README.
 *
 * resolveCounterValue and toDomainPlan below are smaller Prisma-row-to-
 * domain-shape adapters. They're kept here rather than duplicated at each
 * call site — the equipment detail page and work-order completion both need
 * toDomainPlan, for instance, and previously each had its own copy.
 */

import { getDb } from '@/lib/db';
import { findOverlaps, findUnfilledRoles, type Assignment as OverlapAssignment } from '@/lib/domain/scheduling';
import { findEquipmentConflicts } from '@/lib/domain/equipment';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import type { MaintenancePlan as DomainMaintenancePlan } from '@/lib/domain/maintenance';
import {
  computeReadiness,
  crewStatusFrom,
  equipmentStatusFrom,
  complianceStatusFrom,
  weatherStatusFrom,
  permitsStatusFrom,
  type ReadinessResult,
  type ComponentStatus,
} from '@/lib/domain/readiness';
import { checkWeatherSensitivity, type NwsForecastResult } from '@/lib/weather/nws';
import { isPastCalendarDate } from '@/lib/domain/dates';
import type { WeatherSensitivity } from '@/lib/enums';

// Exported so any screen that needs to reproduce a piece of this file's
// readiness math against a subset of the same data (e.g. the mobile field
// view's per-permit row) uses the exact same lookahead window rather than
// a second, hand-typed "14" that could quietly drift from this one.
export const DUE_SOON_WINDOW_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How close to its nominal due point a compliance or maintenance item has to
 * be before it reads as "due soon," expressed in that item's own counter
 * unit. DUE_SOON_WINDOW_DAYS (14) is correct as written only for a
 * CALENDAR_DAYS schedule — it literally is 14 days. Reusing the same "14"
 * for a schedule measured in engine-hours or cycles compares a day count
 * against a different kind of quantity, and badly understates how much
 * runway a heavy-use asset actually has left: 14 run-hours is typically a
 * couple of days' work, not two weeks.
 *
 * These are reference figures for how far out "due soon" should read on
 * each counter — a documented judgment call, the same kind
 * INFORMAL_RECENCY_WINDOW_DAYS makes in lib/domain/certifications.ts —
 * rather than a per-asset rate derived from usage history. A derived window
 * would shrink toward zero for a low-usage asset (an idle asset's rate is
 * ~0, so its "due soon" window would be ~0 too) and behave inconsistently
 * across assets with different duty cycles; a fixed reference window stays
 * predictable, which matters more for a status a PM checks at a glance than
 * being exactly right for any one asset's actual pace.
 */
const DUE_SOON_WINDOW_BY_COUNTER: Record<string, number> = {
  CALENDAR_DAYS: DUE_SOON_WINDOW_DAYS,
  RUN_HOURS: 20, // roughly what two weeks of active field use looks like on an hour meter
  CYCLES: 10,
};

export function resolveDueSoonWindow(counterType: string): number {
  return DUE_SOON_WINDOW_BY_COUNTER[counterType] ?? DUE_SOON_WINDOW_DAYS;
}

/**
 * Resolves the live reading for whichever counter a compliance or
 * maintenance item is governed by. Calendar-day counters are computed on
 * the fly from the asset's in-service date rather than trusted from a
 * stored value, so they can never go stale between seed runs; run-hours
 * and cycle counts genuinely have to come from a recorded reading, since
 * neither can be derived from the clock alone.
 */
export function resolveCounterValue(
  counterType: string,
  equipment: { inServiceDate: Date; lifeCounters: Array<{ counterType: string; currentValue: number }> },
  now: Date,
): number | null {
  if (counterType === 'CALENDAR_DAYS') {
    return Math.floor((now.getTime() - equipment.inServiceDate.getTime()) / DAY_MS);
  }
  const counter = equipment.lifeCounters.find((lc) => lc.counterType === counterType);
  return counter ? counter.currentValue : null;
}

/**
 * Converts a MaintenancePlan row (or the equivalent plain object) into the
 * shape lib/domain/maintenance.ts operates on. A structural parameter type
 * rather than Prisma's generated MaintenancePlan so this stays callable from
 * anywhere a plan-shaped object is in hand, without importing @prisma/client
 * just for the type.
 */
export function toDomainPlan(plan: {
  id: string;
  equipmentId: string;
  parentPlanId: string | null;
  counterType: string;
  intervalValue: number;
  toleranceValue: number;
  hardLimit: boolean;
  dueValue: number;
}): DomainMaintenancePlan {
  return {
    id: plan.id,
    equipmentId: plan.equipmentId,
    parentPlanId: plan.parentPlanId,
    schedule: {
      unit: plan.counterType,
      intervalValue: plan.intervalValue,
      toleranceValue: plan.toleranceValue,
      hardLimit: plan.hardLimit,
      dueValue: plan.dueValue,
    },
  };
}

export async function computeJobReadiness(jobId: string): Promise<ReadinessResult> {
  const prisma = getDb();
  const now = new Date();

  // The queries below split into two waves rather than running one after
  // another: everything in this first Promise.all needs only `jobId` (or
  // nothing beyond it) to run, so there's no reason for e.g. the permits
  // query to wait on the equipment query to finish first. This is the
  // fix for what was previously ~8 fully sequential round trips per job —
  // it doesn't eliminate the N+1 shape across many jobs (that would need a
  // real batch-query rewrite of this function), but for a single job it
  // turns 8 serial round trips into 2 concurrent waves, which is most of
  // the win for a fraction of the risk of restructuring how every caller
  // fetches readiness.
  const [job, roleRequirements, equipment, reservationsForJob, forecastCache, permits] = await Promise.all([
    prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        assignments: {
          include: {
            worker: {
              include: { certifications: true, subcontractor: { include: { coiRecords: true } } },
            },
          },
        },
      },
    }),
    prisma.jobRoleRequirement.findMany({ where: { jobId } }),
    // --- Equipment: any asset currently assigned to this job down for
    // service, or reserved to this job over a window that overlaps another
    // job's reservation for the same asset? ---
    prisma.equipment.findMany({
      where: { currentJobId: jobId },
      include: { compliance: true, lifeCounters: true, maintenancePlans: true },
    }),
    prisma.equipmentReservation.findMany({ where: { jobId } }),
    prisma.weatherCache.findUnique({ where: { jobId_layer: { jobId, layer: 'FORECAST' } } }),
    prisma.permit.findMany({ where: { jobId }, include: { inspections: true } }),
  ]);

  // --- Crew: any of this job's assigned workers double-booked elsewhere? ---
  const workerIds = [...new Set(job.assignments.map((a) => a.workerId))];
  const reservedEquipmentIds = [...new Set(reservationsForJob.map((r) => r.equipmentId))];
  // A reservation booked months out shouldn't be judged against today's
  // incidental asset status — the asset has plenty of time to come back
  // from an unrelated repair before the booking actually starts. Only a
  // reservation that's already active or starting within the same
  // due-soon lookahead used everywhere else in this file is close enough
  // that "this asset is down for service right now" is actually relevant
  // to it.
  const imminentReservationEquipmentIds = [
    ...new Set(
      reservationsForJob
        .filter(
          (r) =>
            r.start.getTime() <= now.getTime() + DUE_SOON_WINDOW_DAYS * DAY_MS &&
            r.end.getTime() >= now.getTime(),
        )
        .map((r) => r.equipmentId),
    ),
  ];

  const [allAssignmentsForCrew, allReservationsForThoseAssets, reservedButDownForService] = await Promise.all([
    workerIds.length ? prisma.assignment.findMany({ where: { workerId: { in: workerIds } } }) : Promise.resolve([]),
    reservedEquipmentIds.length
      ? prisma.equipmentReservation.findMany({ where: { equipmentId: { in: reservedEquipmentIds } } })
      : Promise.resolve([]),
    imminentReservationEquipmentIds.length
      ? prisma.equipment.findMany({
          where: { id: { in: imminentReservationEquipmentIds }, status: 'DOWN_FOR_SERVICE' },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const overlapInput: OverlapAssignment[] = allAssignmentsForCrew.map((a) => ({
    id: a.id,
    workerId: a.workerId,
    jobId: a.jobId,
    roleOnJob: a.roleOnJob,
    start: a.start,
    end: a.end,
  }));
  const conflicts = findOverlaps(overlapInput);
  const hasOverlapConflict = conflicts.some(
    (c) => c.first.jobId === jobId || c.second.jobId === jobId,
  );

  const hasUnfilledRole = findUnfilledRoles(
    roleRequirements.map((r) => ({ id: r.id, roleOrTrade: r.roleOrTrade, requiredCount: r.requiredCount })),
    job.assignments.map((a) => ({ roleOnJob: a.roleOnJob })),
  ).length > 0;

  const crew = crewStatusFrom({ hasOverlapConflict, hasUnfilledRole });
  const crewReason = hasOverlapConflict
    ? 'A crew member is double-booked against another job.'
    : hasUnfilledRole
      ? 'A required role on the staffing plan has nobody assigned.'
      : undefined;

  const hasAssetDownForService = equipment.some((e) => e.status === 'DOWN_FOR_SERVICE');
  const assetsDownForService = equipment.filter((e) => e.status === 'DOWN_FOR_SERVICE');

  const equipmentConflicts = findEquipmentConflicts(
    allReservationsForThoseAssets.map((r) => ({ id: r.id, equipmentId: r.equipmentId, jobId: r.jobId, start: r.start, end: r.end })),
  );
  const hasReservationOverlapConflict = equipmentConflicts.some((c) => c.first.jobId === jobId || c.second.jobId === jobId);

  // A reservation on an asset that's currently down for service is a
  // different problem than two reservations overlapping each other, but it
  // belongs at the same severity: this job doesn't have the asset on site
  // today, so it's a heads-up for whoever's tracking the booking, not a
  // block on today's readiness the way an asset that IS on site and broken
  // would be.
  const hasAssetConflict = hasReservationOverlapConflict || reservedButDownForService.length > 0;

  const equipmentComponent = equipmentStatusFrom({ hasAssetDownForService, hasAssetConflict });
  const equipmentReason = hasAssetDownForService
    ? `${assetsDownForService[0]!.name}${assetsDownForService.length > 1 ? ` and ${assetsDownForService.length - 1} other asset(s)` : ''} on site is down for service.`
    : hasAssetConflict
      ? 'A reserved asset is double-booked or down for service before it arrives.'
      : undefined;

  // --- Compliance: worker certifications, subcontractor entity-level
  // compliance (COI + license), and equipment compliance items ---
  let hasExpiredItem = false;
  let hasExpiringSoonItem = false;
  // First concrete offender found, for the reason string below — not an
  // exhaustive list, just enough for a dashboard reader to know where to
  // start looking without clicking into the job.
  let firstExpiredReason: string | undefined;

  for (const assignment of job.assignments) {
    for (const cert of assignment.worker.certifications) {
      const status = getCertificationStatus(cert.expiryDate, now, undefined, cert.renewalPattern, cert.renewalFiledDate);
      if (status.status === 'expired') {
        hasExpiredItem = true;
        firstExpiredReason ??= `${assignment.worker.name}'s ${cert.certType} certification has expired.`;
      }
      if (status.status === 'expiring_soon' || status.status === 'aging' || status.status === 'renewal_pending') {
        hasExpiringSoonItem = true;
      }
    }

    const subcontractor = assignment.worker.subcontractor;
    if (subcontractor) {
      const subStatus = evaluateSubcontractorCompliance(
        { licenseExpiryDate: subcontractor.licenseExpiryDate, coiRecords: subcontractor.coiRecords },
        now,
      );
      if (subStatus.hasExpiredItem) {
        hasExpiredItem = true;
        firstExpiredReason ??= `${subcontractor.businessName}'s insurance or license on file has expired.`;
      }
      if (subStatus.hasExpiringSoonItem) hasExpiringSoonItem = true;
    }
  }

  for (const item of equipment) {
    for (const c of item.compliance) {
      const currentValue = resolveCounterValue(c.counterType, item, now);
      if (currentValue === null) continue; // data-integrity gap: no reading for this counter — nothing to evaluate

      const status = getComplianceStatus(
        {
          unit: c.counterType,
          intervalValue: c.intervalValue,
          toleranceValue: c.toleranceValue,
          hardLimit: c.hardLimit,
          dueValue: c.dueValue,
        },
        currentValue,
        resolveDueSoonWindow(c.counterType),
      );
      if (status.status === 'overdue') {
        hasExpiredItem = true;
        firstExpiredReason ??= `${item.name}'s ${c.complianceType.toLowerCase()} is overdue.`;
      }
      if (status.status === 'due_soon' || status.status === 'in_tolerance') hasExpiringSoonItem = true;
    }

    // Preventive-maintenance plans feed the same compliance component as
    // calibration/inspection/warranty items above, rather than a separate
    // readiness component of their own — structurally they're the same
    // fixed-interval/tolerance/hardLimit schedule (see
    // lib/domain/maintenance.ts), and an overdue service is the same kind
    // of "this asset's standing has lapsed" fact a PM needs surfaced the
    // same way, whichever table it's tracked in. WorkOrder status isn't
    // separately checked here: an asset actually down for service already
    // shows up via hasAssetDownForService above, so a work order mirrors a
    // fact readiness already has rather than adding a new one.
    for (const plan of item.maintenancePlans) {
      const currentValue = resolveCounterValue(plan.counterType, item, now);
      if (currentValue === null) continue;

      const status = getComplianceStatus(
        {
          unit: plan.counterType,
          intervalValue: plan.intervalValue,
          toleranceValue: plan.toleranceValue,
          hardLimit: plan.hardLimit,
          dueValue: plan.dueValue,
        },
        currentValue,
        resolveDueSoonWindow(plan.counterType),
      );
      if (status.status === 'overdue') {
        hasExpiredItem = true;
        firstExpiredReason ??= `${item.name} is overdue for scheduled maintenance.`;
      }
      if (status.status === 'due_soon' || status.status === 'in_tolerance') hasExpiringSoonItem = true;
    }
  }

  const compliance = complianceStatusFrom({ hasExpiredItem, hasExpiringSoonItem });
  const complianceReason = hasExpiredItem
    ? firstExpiredReason
    : hasExpiringSoonItem
      ? 'A certification, subcontractor compliance item, or equipment compliance item needs review soon.'
      : undefined;

  // --- Weather: live forecast cache against the job's sensitivity tag ---
  // A job that doesn't care about weather at all reads as 'ok' regardless
  // of whether a forecast has ever been fetched for it — there's nothing
  // to be uncertain about. A job that DOES care but has no fresh forecast
  // cached (never viewed, since the forecast refreshes on view rather than
  // on a schedule — see WeatherPanel — or its cache has simply gone stale
  // past staleAfter) reads as 'unknown', not 'ok': this is the fix for
  // weather readiness previously defaulting to a false "ok" for a job
  // nobody had opened yet, on the dashboard and map views that compute
  // readiness without anyone having opened the job first.
  const hasFreshForecast = forecastCache !== null && forecastCache.staleAfter.getTime() > now.getTime();
  let weather: ComponentStatus;
  if (job.weatherSensitivity === 'INSENSITIVE') {
    weather = 'ok';
  } else if (!hasFreshForecast) {
    weather = 'unknown';
  } else {
    const forecast = JSON.parse(forecastCache!.dataJson) as NwsForecastResult;
    // job.weatherSensitivity is a plain Prisma String column (see the
    // schema-level note on this field), not a native enum, so its static
    // type is just `string`. The value is validated against
    // WeatherSensitivity's members on every write (app/api/jobs/route.ts),
    // so this cast reflects a real runtime guarantee rather than papering
    // over one -- the same pattern used at the write side of this field.
    const check = checkWeatherSensitivity(forecast, job.weatherSensitivity as WeatherSensitivity);
    weather = weatherStatusFrom({
      hasSevereRiskInForecastWindow: check.atRisk && job.weatherSensitivity === 'SENSITIVE',
      hasModerateRiskInForecastWindow: check.atRisk && job.weatherSensitivity === 'CONDITIONAL',
    });
  }
  const weatherReason =
    weather === 'unknown'
      ? "No forecast cached for this job yet — open it, or wait for the next session refresh, to check it."
      : weather !== 'ok'
        ? 'The forecast shows weather risk for this job in the coming days.'
        : undefined;

  // --- Permits: any failed inspection or expired permit on this job? ---
  // Calendar-date comparison (see lib/domain/dates.ts), not exact
  // milliseconds — a permit good "through" its expiryDate shouldn't read as
  // expired hours before that date is actually over in the timezone anyone
  // reading the printed date is standing in.
  const expiredPermits = permits.filter(
    (p) => p.status === 'EXPIRED' || (p.expiryDate !== null && isPastCalendarDate(p.expiryDate, now)),
  );
  const hasExpiredPermit = expiredPermits.length > 0;
  const allInspections = permits.flatMap((p) => p.inspections);
  const hasFailedInspection = allInspections.some((i) => i.status === 'FAILED');
  const hasInspectionDueSoon = allInspections.some(
    (i) =>
      i.status === 'SCHEDULED' &&
      i.scheduledDate !== null &&
      i.scheduledDate.getTime() >= now.getTime() &&
      i.scheduledDate.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * DAY_MS,
  );
  const permitsComponent = permitsStatusFrom({ hasFailedInspection, hasExpiredPermit, hasInspectionDueSoon });
  const failedInspectionPermit = permits.find((p) => p.inspections.some((i) => i.status === 'FAILED'));
  const permitsReason = hasFailedInspection
    ? // failedInspectionPermit is guaranteed non-null here: hasFailedInspection
      // is derived from allInspections, which is itself flatMap'd from this
      // same permits array, so a FAILED inspection can only exist on a
      // permit this find() will locate.
      `The ${failedInspectionPermit!.permitType.toLowerCase()} permit has a failed inspection.`
    : hasExpiredPermit
      ? `The ${expiredPermits[0]!.permitType.toLowerCase()} permit has expired.`
      : hasInspectionDueSoon
        ? 'An inspection is coming up in the next two weeks.'
        : undefined;

  const result = computeReadiness({ crew, equipment: equipmentComponent, compliance, weather, permits: permitsComponent });
  return {
    ...result,
    reasons: {
      crew: crewReason,
      equipment: equipmentReason,
      compliance: complianceReason,
      weather: weatherReason,
      permits: permitsReason,
    },
  };
}
