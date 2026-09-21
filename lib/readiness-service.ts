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

import { prisma } from '@/lib/db';
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
} from '@/lib/domain/readiness';
import { checkWeatherSensitivity, type NwsForecastResult } from '@/lib/weather/nws';

const DUE_SOON_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const job = await prisma.job.findUniqueOrThrow({
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
  });

  // --- Crew: any of this job's assigned workers double-booked elsewhere? ---
  const workerIds = [...new Set(job.assignments.map((a) => a.workerId))];
  const allAssignmentsForCrew = workerIds.length
    ? await prisma.assignment.findMany({ where: { workerId: { in: workerIds } } })
    : [];
  const overlapInput: OverlapAssignment[] = allAssignmentsForCrew.map((a) => ({
    id: a.id,
    workerId: a.workerId,
    jobId: a.jobId,
    start: a.start,
    end: a.end,
  }));
  const conflicts = findOverlaps(overlapInput);
  const hasOverlapConflict = conflicts.some(
    (c) => c.first.jobId === jobId || c.second.jobId === jobId,
  );

  const roleRequirements = await prisma.jobRoleRequirement.findMany({ where: { jobId } });
  const hasUnfilledRole = findUnfilledRoles(
    roleRequirements.map((r) => ({ id: r.id, roleOrTrade: r.roleOrTrade, requiredCount: r.requiredCount })),
    job.assignments.map((a) => ({ roleOnJob: a.roleOnJob })),
  ).length > 0;

  const crew = crewStatusFrom({ hasOverlapConflict, hasUnfilledRole });

  // --- Equipment: any asset currently assigned to this job down for service,
  // or reserved to this job over a window that overlaps another job's
  // reservation for the same asset? ---
  const equipment = await prisma.equipment.findMany({
    where: { currentJobId: jobId },
    include: { compliance: true, lifeCounters: true },
  });
  const hasAssetDownForService = equipment.some((e) => e.status === 'DOWN_FOR_SERVICE');

  const reservationsForJob = await prisma.equipmentReservation.findMany({ where: { jobId } });
  const reservedEquipmentIds = [...new Set(reservationsForJob.map((r) => r.equipmentId))];
  const allReservationsForThoseAssets = reservedEquipmentIds.length
    ? await prisma.equipmentReservation.findMany({ where: { equipmentId: { in: reservedEquipmentIds } } })
    : [];
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
  const reservedButDownForService = reservedEquipmentIds.length
    ? await prisma.equipment.findMany({
        where: { id: { in: reservedEquipmentIds }, status: 'DOWN_FOR_SERVICE' },
        select: { id: true },
      })
    : [];
  const hasAssetConflict = hasReservationOverlapConflict || reservedButDownForService.length > 0;

  const equipmentComponent = equipmentStatusFrom({ hasAssetDownForService, hasAssetConflict });

  // --- Compliance: worker certifications, subcontractor entity-level
  // compliance (COI + license), and equipment compliance items ---
  const now = new Date();
  let hasExpiredItem = false;
  let hasExpiringSoonItem = false;

  for (const assignment of job.assignments) {
    for (const cert of assignment.worker.certifications) {
      const status = getCertificationStatus(cert.expiryDate, now, undefined, cert.renewalPattern, cert.renewalFiledDate);
      if (status.status === 'expired') hasExpiredItem = true;
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
      if (subStatus.hasExpiredItem) hasExpiredItem = true;
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
        DUE_SOON_WINDOW_DAYS,
      );
      if (status.status === 'overdue') hasExpiredItem = true;
      if (status.status === 'due_soon' || status.status === 'in_tolerance') hasExpiringSoonItem = true;
    }
  }

  const compliance = complianceStatusFrom({ hasExpiredItem, hasExpiringSoonItem });

  // --- Weather: live forecast cache against the job's sensitivity tag ---
  const forecastCache = await prisma.weatherCache.findUnique({
    where: { jobId_layer: { jobId, layer: 'FORECAST' } },
  });

  let weather: ReturnType<typeof weatherStatusFrom> = 'ok';
  if (forecastCache) {
    const forecast = JSON.parse(forecastCache.dataJson) as NwsForecastResult;
    const check = checkWeatherSensitivity(forecast, job.weatherSensitivity);
    weather = weatherStatusFrom({
      hasSevereRiskInForecastWindow: check.atRisk && job.weatherSensitivity === 'SENSITIVE',
      hasModerateRiskInForecastWindow: check.atRisk && job.weatherSensitivity === 'CONDITIONAL',
    });
  }

  // --- Permits: any failed inspection or expired permit on this job? ---
  const permits = await prisma.permit.findMany({ where: { jobId }, include: { inspections: true } });
  const hasExpiredPermit = permits.some(
    (p) => p.status === 'EXPIRED' || (p.expiryDate !== null && p.expiryDate.getTime() < now.getTime()),
  );
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

  return computeReadiness({ crew, equipment: equipmentComponent, compliance, weather, permits: permitsComponent });
}
