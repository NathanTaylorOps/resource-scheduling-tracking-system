/**
 * Prisma orchestration for the five readiness evaluators. Component-specific
 * rules live in lib/readiness so this file stays focused on batched data
 * loading and composition.
 */
import { getDb } from '@/lib/db';
import { computeReadiness, type ReadinessResult } from '@/lib/domain/readiness';
import { evaluateCrewReadiness } from '@/lib/readiness/crew';
import { evaluateEquipmentReadiness } from '@/lib/readiness/equipment';
import { evaluateComplianceReadiness } from '@/lib/readiness/compliance';
import { evaluateWeatherReadiness } from '@/lib/readiness/weather';
import { evaluatePermitReadiness } from '@/lib/readiness/permits';
import { DAY_MS, DUE_SOON_WINDOW_DAYS } from '@/lib/readiness/equipment-counters';

export { DAY_MS, DUE_SOON_WINDOW_DAYS, resolveCounterValue, resolveDueSoonWindow, toDomainPlan } from '@/lib/readiness/equipment-counters';

// Prisma's generated row shapes for the include-heavy queries below. Named
// here once so both computeReadinessForJobs and the per-job derivation
// function it drives can share the same parameter types instead of each
// re-deriving them from a query shape.
type JobWithAssignments = Awaited<ReturnType<typeof fetchJobsWithAssignments>>[number];
type EquipmentWithCompliance = Awaited<ReturnType<typeof fetchEquipmentForJobs>>[number];
type PermitWithInspections = Awaited<ReturnType<typeof fetchPermitsForJobs>>[number];

function fetchJobsWithAssignments(prisma: Awaited<ReturnType<typeof getDb>>, jobIds: string[]) {
  return prisma.job.findMany({
    where: { id: { in: jobIds } },
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
}

function fetchEquipmentForJobs(prisma: Awaited<ReturnType<typeof getDb>>, jobIds: string[]) {
  return prisma.equipment.findMany({
    where: { currentJobId: { in: jobIds } },
    include: { compliance: true, lifeCounters: true, maintenancePlans: true },
  });
}

function fetchPermitsForJobs(prisma: Awaited<ReturnType<typeof getDb>>, jobIds: string[]) {
  return prisma.permit.findMany({ where: { jobId: { in: jobIds } }, include: { inspections: true } });
}

/** Groups an array of rows by a key derived from each row, preserving row order within each group. */
function groupBy<T, K>(rows: T[], keyOf: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = out.get(key);
    if (bucket) bucket.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/**
 * Computes readiness for every job in `jobIds` from a single batched round of
 * queries, instead of one full query set per job. This is what every list
 * view (the dashboard, /map, /portfolio, /field) should call instead of
 * mapping computeJobReadiness over each job individually — that per-job
 * pattern was still an N+1 shape across the *list*, even though each
 * individual job's own queries were already reduced to two concurrent waves.
 *
 * The batching mirrors computeJobReadiness's own two-wave shape, just widened
 * from "this one job" to "every job in jobIds" at each wave: the first wave
 * fetches everything keyed off jobId directly (or nothing beyond it); the
 * second wave fetches the cross-job facts a double-booking or an equipment
 * conflict actually depends on (every assignment for any worker touched by
 * any of these jobs, every reservation for any equipment touched by any of
 * these jobs), once for the whole batch rather than once per job.
 */
export async function computeReadinessForJobs(jobIds: string[]): Promise<Map<string, ReadinessResult>> {
  const results = new Map<string, ReadinessResult>();
  if (jobIds.length === 0) return results;

  const prisma = await getDb();
  const now = new Date();

  const [jobs, roleRequirements, equipment, reservations, forecastCaches, permits] = await Promise.all([
    fetchJobsWithAssignments(prisma, jobIds),
    prisma.jobRoleRequirement.findMany({ where: { jobId: { in: jobIds } } }),
    fetchEquipmentForJobs(prisma, jobIds),
    prisma.equipmentReservation.findMany({ where: { jobId: { in: jobIds } } }),
    prisma.weatherCache.findMany({ where: { jobId: { in: jobIds }, layer: 'FORECAST' } }),
    fetchPermitsForJobs(prisma, jobIds),
  ]);

  const roleRequirementsByJob = groupBy(roleRequirements, (r) => r.jobId);
  const equipmentByJob = groupBy(equipment, (e) => e.currentJobId as string);
  const reservationsByJob = groupBy(reservations, (r) => r.jobId);
  const forecastByJob = new Map(forecastCaches.map((f) => [f.jobId, f]));
  const permitsByJob = groupBy(permits, (p) => p.jobId);

  // --- Cross-job facts, fetched once for the whole batch ---
  // Every worker assigned to any job in this batch, and every reservation's
  // equipment for any job in this batch: a double-booking or an equipment
  // conflict can involve a job outside jobIds (e.g. the other half of the
  // overlap), so these queries stay scoped to workers/equipment rather than
  // to jobIds, exactly as they were per-job before batching.
  const workerIds = [...new Set(jobs.flatMap((j) => j.assignments.map((a) => a.workerId)))];
  const reservedEquipmentIds = [...new Set(reservations.map((r) => r.equipmentId))];
  // Same "imminent" cutoff as before, computed once across every reservation
  // in the batch rather than per job — the cutoff itself doesn't depend on
  // which job a reservation belongs to.
  const imminentReservationEquipmentIds = [
    ...new Set(
      reservations
        .filter(
          (r) =>
            r.start.getTime() <= now.getTime() + DUE_SOON_WINDOW_DAYS * DAY_MS &&
            r.end.getTime() >= now.getTime(),
        )
        .map((r) => r.equipmentId),
    ),
  ];

  const [allAssignmentsForWorkers, allReservationsForThoseAssets, downForServiceEquipment] = await Promise.all([
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

  const assignmentsByWorker = groupBy(allAssignmentsForWorkers, (a) => a.workerId);
  const reservationsByEquipment = groupBy(allReservationsForThoseAssets, (r) => r.equipmentId);
  const downForServiceIds = new Set(downForServiceEquipment.map((e) => e.id));

  for (const job of jobs) {
    results.set(
      job.id,
      deriveJobReadiness({
        job,
        roleRequirements: roleRequirementsByJob.get(job.id) ?? [],
        equipment: equipmentByJob.get(job.id) ?? [],
        reservationsForJob: reservationsByJob.get(job.id) ?? [],
        forecastCache: forecastByJob.get(job.id) ?? null,
        permits: permitsByJob.get(job.id) ?? [],
        assignmentsByWorker,
        reservationsByEquipment,
        downForServiceIds,
        now,
      }),
    );
  }

  return results;
}

/**
 * Single-job convenience wrapper around computeReadinessForJobs, kept for
 * the job detail and field-detail pages that only ever need one job's
 * readiness. A list view (dashboard, /map, /portfolio, /field) should call
 * computeReadinessForJobs directly with every job id at once instead of
 * mapping this over a list — that per-job mapping is exactly the N+1 shape
 * this file used to have.
 */
export async function computeJobReadiness(jobId: string): Promise<ReadinessResult> {
  const result = (await computeReadinessForJobs([jobId])).get(jobId);
  if (!result) throw new Error(`computeJobReadiness: job ${jobId} not found`);
  return result;
}

function deriveJobReadiness(ctx: {
  job: JobWithAssignments;
  roleRequirements: Array<{ id: string; roleOrTrade: string; requiredCount: number }>;
  equipment: EquipmentWithCompliance[];
  reservationsForJob: Array<{ id: string; equipmentId: string; jobId: string; start: Date; end: Date }>;
  forecastCache: { dataJson: string; staleAfter: Date } | null;
  permits: PermitWithInspections[];
  assignmentsByWorker: Map<string, Array<{ id: string; workerId: string; jobId: string; roleOnJob: string; start: Date; end: Date }>>;
  reservationsByEquipment: Map<string, Array<{ id: string; equipmentId: string; jobId: string; start: Date; end: Date }>>;
  downForServiceIds: Set<string>;
  now: Date;
}): ReadinessResult {
  const { job, roleRequirements, equipment, reservationsForJob, forecastCache, permits, assignmentsByWorker, reservationsByEquipment, downForServiceIds, now } = ctx;
  const workerIds = [...new Set(job.assignments.map((a) => a.workerId))];
  const reservedEquipmentIds = [...new Set(reservationsForJob.map((r) => r.equipmentId))];
  const imminentEquipmentIds = [...new Set(reservationsForJob
    .filter((r) => r.start.getTime() <= now.getTime() + DUE_SOON_WINDOW_DAYS * DAY_MS && r.end.getTime() >= now.getTime())
    .map((r) => r.equipmentId))];

  const crew = evaluateCrewReadiness({
    jobId: job.id,
    assignments: job.assignments.map((a) => ({ workerId: a.workerId, roleOnJob: a.roleOnJob })),
    roleRequirements,
    allAssignmentsForCrew: workerIds.flatMap((id) => assignmentsByWorker.get(id) ?? []),
  });
  const equipmentResult = evaluateEquipmentReadiness({
    jobId: job.id,
    onSiteEquipment: equipment,
    reservations: reservedEquipmentIds.flatMap((id) => reservationsByEquipment.get(id) ?? []),
    reservedButDownForService: imminentEquipmentIds.filter((id) => downForServiceIds.has(id)),
  });
  const compliance = evaluateComplianceReadiness({ assignments: job.assignments, equipment, now });
  const weather = evaluateWeatherReadiness({ weatherSensitivity: job.weatherSensitivity, forecastCache, now });
  const permitResult = evaluatePermitReadiness({ permits, now });

  const result = computeReadiness({
    crew: crew.status,
    equipment: equipmentResult.status,
    compliance: compliance.status,
    weather: weather.status,
    permits: permitResult.status,
  });
  return {
    ...result,
    reasons: {
      crew: crew.reason,
      equipment: equipmentResult.reason,
      compliance: compliance.reason,
      weather: weather.reason,
      permits: permitResult.reason,
    },
  };
}
