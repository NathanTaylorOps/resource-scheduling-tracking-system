import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { findOverlaps, findUnfilledRoles, type Assignment as OverlapAssignment } from '@/lib/domain/scheduling';
import { findEquipmentConflicts } from '@/lib/domain/equipment';
import { getCertificationStatus, summarizeCertificationStatuses } from '@/lib/domain/certifications';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { StatusBadge } from '@/components/StatusBadge';
import type { ComponentStatus } from '@/lib/domain/readiness';
import { WeatherPanel } from '@/components/WeatherPanel';
import { JobRequirementsEditor } from '@/components/JobRequirementsEditor';
import { AssignWorkerForm } from '@/components/AssignWorkerForm';
import { PermitsEditor } from '@/components/PermitsEditor';
import { DailyLogForm } from '@/components/DailyLogForm';
import { ToolboxTalkForm } from '@/components/ToolboxTalkForm';
import { ToolboxTalkList } from '@/components/ToolboxTalkList';
import { LienWaiversEditor } from '@/components/LienWaiversEditor';
import { SafetyIncidentsEditor } from '@/components/SafetyIncidentsEditor';
import { HazardAnalysesEditor } from '@/components/HazardAnalysesEditor';
import { PayrollEntriesEditor } from '@/components/PayrollEntriesEditor';
import { RoleContextBanner } from '@/components/RoleContextBanner';
import { getViewingActor } from '@/lib/actor';
import { permissionsFor } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const prisma = getDb();
  const actor = getViewingActor();
  const perms = permissionsFor(actor.role);
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      assignments: {
        include: {
          worker: {
            include: { certifications: true, subcontractor: { include: { coiRecords: true } } },
          },
        },
        orderBy: { start: 'asc' },
      },
    },
  });
  if (!job) notFound();

  const equipment = await prisma.equipment.findMany({
    where: { currentJobId: job.id },
    include: { compliance: true },
  });

  // Every worker on file, for the assign-crew picker below — not scoped to
  // this job (or to whoever's already assigned), since assigning someone
  // new to a job is exactly the case that picker exists for.
  const allWorkers = await prisma.worker.findMany({
    select: { id: true, name: true, trade: true },
    orderBy: { name: 'asc' },
  });

  const readiness = await computeJobReadiness(job.id);
  const now = new Date();

  const workerIds = [...new Set(job.assignments.map((a) => a.workerId))];
  const allAssignments = workerIds.length
    ? await prisma.assignment.findMany({ where: { workerId: { in: workerIds } } })
    : [];
  const overlapInput: OverlapAssignment[] = allAssignments.map((a) => ({ id: a.id, workerId: a.workerId, jobId: a.jobId, roleOnJob: a.roleOnJob, start: a.start, end: a.end }));
  const conflicts = findOverlaps(overlapInput).filter((c) => c.first.jobId === job.id || c.second.jobId === job.id);

  // findOverlaps only pairs a worker against their own other assignments, so
  // the worker behind any conflict on this job is always someone already in
  // job.assignments — named here rather than surfacing their raw worker id.
  const workerNameById = new Map(job.assignments.map((a) => [a.worker.id, a.worker.name]));
  const conflictedWorkerNames = [...new Set(conflicts.map((c) => workerNameById.get(c.first.workerId) ?? 'A crew member'))];

  // --- Crew requirements: this job's staffing plan against who's actually assigned ---
  const roleRequirements = await prisma.jobRoleRequirement.findMany({ where: { jobId: job.id }, orderBy: { roleOrTrade: 'asc' } });
  const assignedCountByRole = new Map<string, number>();
  for (const a of job.assignments) {
    assignedCountByRole.set(a.roleOnJob, (assignedCountByRole.get(a.roleOnJob) ?? 0) + 1);
  }
  const unfilledRoles = findUnfilledRoles(
    roleRequirements.map((r) => ({ id: r.id, roleOrTrade: r.roleOrTrade, requiredCount: r.requiredCount })),
    job.assignments.map((a) => ({ roleOnJob: a.roleOnJob })),
  );

  // --- Subcontractor compliance: entity-level COI/license standing for any
  // subcontractor firm with a worker assigned here, distinct from the
  // individual certifications checked per assignment below ---
  const subcontractorsOnJob = new Map(
    job.assignments
      .filter((a) => a.worker.subcontractor)
      .map((a) => [a.worker.subcontractor!.id, a.worker.subcontractor!]),
  );
  const subcontractorIssues = [...subcontractorsOnJob.values()]
    .map((sub) => ({ sub, compliance: evaluateSubcontractorCompliance({ licenseExpiryDate: sub.licenseExpiryDate, coiRecords: sub.coiRecords }, now) }))
    .filter(({ compliance }) => compliance.hasExpiredItem || compliance.hasExpiringSoonItem);
  const lapsedSubcontractors = subcontractorIssues.filter(({ compliance }) => compliance.hasExpiredItem);
  const reviewSubcontractors = subcontractorIssues.filter(({ compliance }) => !compliance.hasExpiredItem);

  // --- Equipment reservations: forward bookings on this job's assets, checked
  // for the same kind of overlap findOverlaps checks for crew ---
  const reservationsForJob = await prisma.equipmentReservation.findMany({
    where: { jobId: job.id },
    include: { equipment: true },
    orderBy: { start: 'asc' },
  });
  const reservedEquipmentIds = [...new Set(reservationsForJob.map((r) => r.equipmentId))];
  const allReservationsForThoseAssets = reservedEquipmentIds.length
    ? await prisma.equipmentReservation.findMany({
        where: { equipmentId: { in: reservedEquipmentIds } },
        include: { equipment: true },
      })
    : [];
  const equipmentConflicts = findEquipmentConflicts(
    allReservationsForThoseAssets.map((r) => ({ id: r.id, equipmentId: r.equipmentId, jobId: r.jobId, start: r.start, end: r.end })),
  ).filter((c) => c.first.jobId === job.id || c.second.jobId === job.id);
  const conflictedEquipmentNames = [...new Set(
    equipmentConflicts.map((c) => allReservationsForThoseAssets.find((r) => r.equipmentId === c.equipmentId)?.equipment.name ?? 'An asset'),
  )];

  // A reservation on an asset that's currently down for service — a
  // different problem than two reservations overlapping, same "worth a
  // heads-up before it becomes a surprise" severity (see the matching note
  // in lib/readiness-service.ts, which feeds this into the same equipment
  // readiness component).
  const reservedButDownForService = reservationsForJob.filter((r) => r.equipment.status === 'DOWN_FOR_SERVICE');

  // --- Permits & inspections ---
  const permits = await prisma.permit.findMany({
    where: { jobId: job.id },
    include: { inspections: { orderBy: { sequence: 'asc' } } },
    orderBy: { appliedDate: 'asc' },
  });
  const failedInspections = permits.flatMap((p) =>
    p.inspections.filter((i) => i.status === 'FAILED').map((i) => ({ permit: p, inspection: i })),
  );
  const expiredPermits = permits.filter(
    (p) => p.status === 'EXPIRED' || (p.expiryDate !== null && p.expiryDate.getTime() < now.getTime()),
  );

  // --- Daily field log and toolbox talks: informational, don't feed readiness ---
  const dailyLogs = await prisma.dailyLog.findMany({
    where: { jobId: job.id },
    include: { submittedByWorker: true },
    orderBy: { logDate: 'desc' },
  });
  const safetyMeetings = await prisma.safetyMeeting.findMany({
    where: { jobId: job.id },
    include: { conductedByWorker: true, attendees: { include: { worker: true } } },
    orderBy: { meetingDate: 'desc' },
  });

  // --- Lien waivers, safety incidents, JHAs, and (if required) certified
  // payroll: separate queries rather than folded into the job include
  // above, matching this file's existing pattern for permits/dailyLogs/
  // safetyMeetings just above ---
  const lienWaivers = await prisma.lienWaiver.findMany({
    where: { jobId: job.id },
    include: { subcontractor: { select: { id: true, businessName: true } } },
    orderBy: { payPeriodStart: 'desc' },
  });
  const safetyIncidents = await prisma.safetyIncident.findMany({
    where: { jobId: job.id },
    include: { reportedByWorker: true, involvedWorker: true },
    orderBy: { occurredAt: 'desc' },
  });
  const hazardAnalyses = await prisma.jobHazardAnalysis.findMany({
    where: { jobId: job.id },
    include: { preparedByWorker: true },
    orderBy: { reviewDate: 'desc' },
  });
  const payrollEntries = job.certifiedPayrollRequired
    ? await prisma.certifiedPayrollEntry.findMany({
        where: { jobId: job.id },
        include: { worker: { select: { id: true, name: true } } },
        orderBy: { weekEnding: 'desc' },
      })
    : [];

  // Any contracted subcontractor firm is waiver-able against this job, not
  // just one with a worker currently assigned here — a lien waiver tracks
  // the contract, not today's staffing.
  const allSubcontractors = await prisma.subcontractor.findMany({
    select: { id: true, businessName: true },
    orderBy: { businessName: 'asc' },
  });

  // --- Recent activity: the audit trail on exactly the fields lib/audit.ts
  // actually writes to (see its own comment for why the list stops there)
  // — permit status, inspection outcomes, lien waiver status, safety
  // incident status. AuditLogEntry has no jobId of its own (it's keyed by
  // entityType/entityId against whatever it's attached to), so this job's
  // slice is whatever entry's entityId matches one of this job's own
  // permits, inspections, lien waivers, or safety incidents.
  const auditableEntityIds = [
    ...permits.map((p) => p.id),
    ...permits.flatMap((p) => p.inspections.map((i) => i.id)),
    ...lienWaivers.map((w) => w.id),
    ...safetyIncidents.map((i) => i.id),
  ];
  const recentActivity = auditableEntityIds.length
    ? await prisma.auditLogEntry.findMany({
        where: { entityId: { in: auditableEntityIds } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      })
    : [];

  // --- Weather-exposure JHA suggestion: a lightweight nudge, not a gate.
  // A job flagged weather-sensitive or conditional has exposure-related
  // tasks (cold/heat stress, wet footing, wind on elevated work) worth
  // their own hazard analysis; this just surfaces that if nothing on file
  // already reads like it covers it, rather than requiring one — an
  // INSENSITIVE job, or one that's already filed a weather-flavored JHA,
  // gets no nudge at all.
  const WEATHER_HAZARD_KEYWORDS = ['weather', 'rain', 'wind', 'heat', 'cold', 'ice', 'lightning', 'storm'];
  const hasWeatherJha = hazardAnalyses.some((jha) =>
    WEATHER_HAZARD_KEYWORDS.some(
      (kw) => jha.taskDescription.toLowerCase().includes(kw) || jha.hazardsIdentified.toLowerCase().includes(kw),
    ),
  );
  const suggestWeatherJha = job.weatherSensitivity !== 'INSENSITIVE' && !hasWeatherJha;

  // Today's log, if there is one — DailyLog's one-per-job-per-day constraint
  // means this is the record the log form below edits in place rather than
  // trying (and 409-ing) to create a second one for today.
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysLog = dailyLogs.find((log) => log.logDate.toISOString().slice(0, 10) === todayKey) ?? null;

  // The crew list both the daily-log and toolbox-talk forms below draw
  // their worker pickers from — whoever's actually assigned to this job,
  // deduplicated the same way workerNameById above already does.
  const crewOnJob = [...new Map(job.assignments.map((a) => [a.worker.id, { id: a.worker.id, name: a.worker.name }])).values()];
  // A visiting PM, GM, or superintendent covering the daily log isn't
  // necessarily staffed on this job — see DailyLogForm's own comment on
  // otherWorkers.
  const crewOnJobIds = new Set(crewOnJob.map((w) => w.id));
  const otherWorkers = allWorkers.filter((w) => !crewOnJobIds.has(w.id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
          ← Jobs
        </Link>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <p className="text-sm text-zinc-500">{job.address}</p>
          </div>
          {/* StatusBadge is an inline-flex span, but as a direct flex-item child
              of the flex-col (mobile) state of the row above, it still
              inherits the parent's default items-stretch and stretches to a
              full-width bar below the sm: breakpoint — inline-flex governs
              its OWN children's layout, not how it behaves as someone else's
              flex item. self-start opts it out of that stretch; sm:self-center
              matches the row's own sm:items-center once it's actually a row. */}
          <div className="self-start sm:self-center">
            <StatusBadge status={readiness.overall} label={readiness.overall === 'ok' ? 'Ready' : readiness.overall === 'warning' ? 'Needs attention' : 'Blocked'} />
          </div>
        </div>
      </div>

      <RoleContextBanner role={actor.role} perms={perms} />

      {/* Readiness breakdown — decomposed, never a single opaque score */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Readiness breakdown</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ReadinessRow label="Crew" status={readiness.crew} />
          <ReadinessRow label="Equipment" status={readiness.equipment} />
          <ReadinessRow label="Compliance" status={readiness.compliance} />
          <ReadinessRow label="Weather" status={readiness.weather} />
          <ReadinessRow label="Permits" status={readiness.permits} />
        </div>
        {conflicts.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Scheduling conflict: {conflictedWorkerNames.join(', ')} — assigned to two jobs at once during an
            overlapping window.
          </p>
        )}
        {unfilledRoles.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Unfilled: {unfilledRoles
              .map((r) => `${r.roleOrTrade} (${assignedCountByRole.get(r.roleOrTrade) ?? 0} of ${r.requiredCount})`)
              .join(', ')}.
          </p>
        )}
        {equipmentConflicts.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Equipment conflict: {conflictedEquipmentNames.join(', ')} — reserved to two jobs over an overlapping
            window.
          </p>
        )}
        {reservedButDownForService.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Reserved but out of service: {[...new Set(reservedButDownForService.map((r) => r.equipment.name))].join(', ')} —
            currently down for service ahead of its booked window here.
          </p>
        )}
        {lapsedSubcontractors.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Subcontractor compliance lapsed: {lapsedSubcontractors.map(({ sub }) => sub.businessName).join(', ')} —
            insurance or license on file has expired.
          </p>
        )}
        {reviewSubcontractors.length > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            Subcontractor compliance to review: {reviewSubcontractors.map(({ sub }) => sub.businessName).join(', ')}.
          </p>
        )}
        {failedInspections.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Failed inspection: {failedInspections
              .map(({ permit, inspection }) => `${inspection.inspectionType.replace(/_/g, ' ').toLowerCase()} (${permit.permitType.toLowerCase()} permit)`)
              .join(', ')}.
          </p>
        )}
        {expiredPermits.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Expired permit: {expiredPermits.map((p) => p.permitType.toLowerCase()).join(', ')}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Crew */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Crew assigned</h2>
          <ul className="divide-y divide-outdoor-border">
            {job.assignments.map((a) => {
              const certStatuses = a.worker.certifications.map(
                (c) => getCertificationStatus(c.expiryDate, now, undefined, c.renewalPattern, c.renewalFiledDate).status,
              );
              // A true expiry is a different severity than aging/expiring-
              // soon/renewal-pending — collapsing all four into one amber
              // "to review" count (as this used to) hides a genuinely lapsed
              // credential behind the same soft wording a merely-aging OSHA
              // card gets, unlike the subcontractor-compliance treatment
              // just below, which has always kept expired and to-review
              // separate. summarizeCertificationStatuses is the shared rule
              // for that split — see lib/domain/certifications.ts — so this
              // page and the mobile field view can't quietly disagree on it.
              const { expiredCount: expiredCerts, reviewCount: toReviewCerts } = summarizeCertificationStatuses(certStatuses);
              const subCompliance = a.worker.subcontractor
                ? evaluateSubcontractorCompliance(
                    { licenseExpiryDate: a.worker.subcontractor.licenseExpiryDate, coiRecords: a.worker.subcontractor.coiRecords },
                    now,
                  )
                : null;
              return (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link href={`/workers/${a.worker.id}`} className="font-medium hover:underline">
                      {a.worker.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {a.roleOnJob} · {a.start.toLocaleDateString()} – {a.end.toLocaleDateString()}
                      {a.worker.subcontractor && ` · ${a.worker.subcontractor.businessName}`}
                    </div>
                  </div>
                  <div className="text-right">
                    {expiredCerts > 0 && (
                      <div className="text-xs font-medium text-red-700">{expiredCerts} cert{expiredCerts > 1 ? 's' : ''} expired</div>
                    )}
                    {toReviewCerts > 0 && (
                      <div className="text-xs font-medium text-amber-700">{toReviewCerts} cert{toReviewCerts > 1 ? 's' : ''} to review</div>
                    )}
                    {subCompliance?.hasExpiredItem && <div className="text-xs font-medium text-red-700">Firm compliance lapsed</div>}
                    {!subCompliance?.hasExpiredItem && subCompliance?.hasExpiringSoonItem && (
                      <div className="text-xs font-medium text-amber-700">Firm compliance to review</div>
                    )}
                  </div>
                </li>
              );
            })}
            {job.assignments.length === 0 && <p className="py-2 text-sm text-zinc-500">No crew assigned yet.</p>}
          </ul>
          <AssignWorkerForm
            jobId={job.id}
            workers={allWorkers}
            roleRequirements={roleRequirements.map((r) => ({ roleOrTrade: r.roleOrTrade }))}
          />
        </div>

        {/* Equipment */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Equipment on site</h2>
          <ul className="divide-y divide-outdoor-border">
            {equipment.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <div>
                  <Link href={`/equipment/${e.id}`} className="font-medium hover:underline">
                    {e.name}
                  </Link>
                  <div className="text-xs text-zinc-500">{e.category} · {e.qrCode}</div>
                </div>
                <span className={`text-xs font-medium ${e.status === 'DOWN_FOR_SERVICE' ? 'text-red-700' : 'text-zinc-500'}`}>
                  {e.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </li>
            ))}
            {equipment.length === 0 && <p className="py-2 text-sm text-zinc-500">No equipment currently assigned.</p>}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Crew requirements — the staffing plan, independent of who's actually assigned */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Crew requirements</h2>
          <JobRequirementsEditor
            jobId={job.id}
            requirements={roleRequirements.map((r) => ({ id: r.id, roleOrTrade: r.roleOrTrade, requiredCount: r.requiredCount, requiredCertTypes: r.requiredCertTypes }))}
            assignedCountByRole={Object.fromEntries(assignedCountByRole)}
          />
        </div>

        {/* Permits & inspections */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Permits &amp; inspections</h2>
          <PermitsEditor
            jobId={job.id}
            canApprovePermits={perms.canApprovePermits}
            permits={permits.map((p) => ({
              id: p.id,
              permitType: p.permitType,
              permitNumber: p.permitNumber,
              issuingAuthority: p.issuingAuthority,
              status: p.status,
              appliedDate: p.appliedDate.toISOString(),
              issuedDate: p.issuedDate?.toISOString() ?? null,
              expiryDate: p.expiryDate?.toISOString() ?? null,
              // Same check the readiness banner above already uses for
              // expiredPermits — a permit whose expiryDate has passed reads
              // as expired here too, even before its stored status field has
              // been updated to say so.
              isExpired: p.status === 'EXPIRED' || (p.expiryDate !== null && p.expiryDate.getTime() < now.getTime()),
              inspections: p.inspections.map((i) => ({
                id: i.id,
                inspectionType: i.inspectionType,
                sequence: i.sequence,
                status: i.status,
                scheduledDate: i.scheduledDate?.toISOString() ?? null,
                completedDate: i.completedDate?.toISOString() ?? null,
                inspectorNotes: i.inspectorNotes,
                correctionNotes: i.correctionNotes,
                correctionResponsible: i.correctionResponsible,
                reinspectionChannel: i.reinspectionChannel,
                reinspectionScheduledDate: i.reinspectionScheduledDate?.toISOString() ?? null,
              })),
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily field log — standard GC documentation, informational only */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Daily field log</h2>
          <ul className="divide-y divide-outdoor-border">
            {dailyLogs.map((log) => (
              <li key={log.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{log.logDate.toLocaleDateString()}</span>
                  <span className="text-xs text-zinc-500">
                    {log.crewCount} on site{log.weatherSummary ? ` · ${log.weatherSummary}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-700">{log.workPerformed}</p>
                {log.delaysNotes && <p className="mt-1 text-xs text-amber-700">Delay: {log.delaysNotes}</p>}
                <div className="mt-1 text-xs text-zinc-400">
                  Logged by{' '}
                  {log.submittedByWorker ? (
                    <Link href={`/workers/${log.submittedByWorker.id}`} className="hover:underline">
                      {log.submittedByWorker.name}
                    </Link>
                  ) : (
                    'Unattributed'
                  )}
                </div>
              </li>
            ))}
            {dailyLogs.length === 0 && <p className="py-2 text-sm text-zinc-500">No daily logs submitted yet.</p>}
          </ul>
          <DailyLogForm
            jobId={job.id}
            crew={crewOnJob}
            otherWorkers={otherWorkers}
            existingLog={
              todaysLog && {
                id: todaysLog.id,
                logDate: todaysLog.logDate.toISOString(),
                weatherSummary: todaysLog.weatherSummary,
                crewCount: todaysLog.crewCount,
                workPerformed: todaysLog.workPerformed,
                delaysNotes: todaysLog.delaysNotes,
                submittedBy: todaysLog.submittedBy,
              }
            }
          />
        </div>

        {/* Toolbox talks — safety-culture documentation, not a readiness gate */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Toolbox talks</h2>
          <ToolboxTalkList
            jobId={job.id}
            meetings={safetyMeetings.map((meeting) => ({
              id: meeting.id,
              topic: meeting.topic,
              meetingDate: meeting.meetingDate.toISOString(),
              conductedByWorker: { id: meeting.conductedByWorker.id, name: meeting.conductedByWorker.name },
              attendees: meeting.attendees.map((a) => ({ worker: { id: a.worker.id, name: a.worker.name } })),
            }))}
          />
          <ToolboxTalkForm jobId={job.id} crew={crewOnJob} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Lien waivers — pay-application lien-rights tracking, not a readiness gate */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Lien waivers</h2>
          <LienWaiversEditor
            jobId={job.id}
            subcontractors={allSubcontractors}
            canViewFinancials={perms.canViewFinancials}
            waivers={lienWaivers.map((w) => ({
              id: w.id,
              subcontractor: { id: w.subcontractor.id, businessName: w.subcontractor.businessName },
              waiverType: w.waiverType,
              payPeriodStart: w.payPeriodStart.toISOString(),
              payPeriodEnd: w.payPeriodEnd.toISOString(),
              amount: w.amount,
              status: w.status,
              receivedDate: w.receivedDate?.toISOString() ?? null,
              notes: w.notes,
            }))}
          />
        </div>

        {/* Safety incidents */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Safety incidents</h2>
          <SafetyIncidentsEditor
            jobId={job.id}
            crew={crewOnJob}
            canManageSafety={perms.canManageSafety}
            incidents={safetyIncidents.map((i) => ({
              id: i.id,
              incidentType: i.incidentType,
              severity: i.severity,
              occurredAt: i.occurredAt.toISOString(),
              description: i.description,
              correctionAction: i.correctionAction,
              status: i.status,
              reportedByWorker: i.reportedByWorker ? { id: i.reportedByWorker.id, name: i.reportedByWorker.name } : null,
              involvedWorker: i.involvedWorker ? { id: i.involvedWorker.id, name: i.involvedWorker.name } : null,
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Job hazard analyses */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Job hazard analyses</h2>
          {suggestWeatherJha && (
            <p className="mb-3 rounded-md border border-dashed border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              This job is flagged {job.weatherSensitivity.toLowerCase()} to weather, and nothing on file here reads
              like it covers exposure — consider filing a JHA for weather-related hazards (cold/heat stress,
              wet-surface footing, wind on elevated work).
            </p>
          )}
          <HazardAnalysesEditor
            jobId={job.id}
            crew={crewOnJob}
            canManageSafety={perms.canManageSafety}
            analyses={hazardAnalyses.map((jha) => ({
              id: jha.id,
              taskDescription: jha.taskDescription,
              hazardsIdentified: jha.hazardsIdentified,
              controlMeasures: jha.controlMeasures,
              reviewDate: jha.reviewDate.toISOString(),
              preparedByWorker: jha.preparedByWorker ? { id: jha.preparedByWorker.id, name: jha.preparedByWorker.name } : null,
            }))}
          />
        </div>

        {/* Certified payroll — only for jobs contractually bound to it (see Job.certifiedPayrollRequired) */}
        {job.certifiedPayrollRequired && (
          <div className="card">
            <h2 className="mb-3 font-semibold">Certified payroll</h2>
            <PayrollEntriesEditor
              jobId={job.id}
              crew={crewOnJob}
              canViewFinancials={perms.canViewFinancials}
              entries={payrollEntries.map((e) => ({
                id: e.id,
                worker: { id: e.worker.id, name: e.worker.name },
                weekEnding: e.weekEnding.toISOString(),
                classification: e.classification,
                hoursWorked: e.hoursWorked,
                hourlyRate: e.hourlyRate,
                fringeRate: e.fringeRate,
                status: e.status,
              }))}
            />
          </div>
        )}
      </div>

      {/* Recent activity — the audit trail lib/audit.ts writes to, made
          visible. Read-only: this is a log of what changed, not something
          you act on from here. */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Status changes on this job&apos;s permits, inspections, lien waivers, and safety incidents — the fields
          most likely to be disputed later. Not every mutation in the app is logged, only these (see the
          README&apos;s &quot;Scaling to enterprise&quot; section).
        </p>
        <ul className="divide-y divide-outdoor-border">
          {recentActivity.map((entry) => (
            <li key={entry.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ENTITY_TYPE_LABEL[entry.entityType] ?? entry.entityType}</span>
                <span className="text-xs text-zinc-400">{entry.createdAt.toLocaleString()}</span>
              </div>
              <p className="mt-0.5 text-zinc-700">{entry.summary}</p>
              <p className="mt-0.5 text-xs text-zinc-400">by {entry.actorLabel}</p>
            </li>
          ))}
          {recentActivity.length === 0 && <p className="py-2 text-sm text-zinc-500">No audited changes on this job yet.</p>}
        </ul>
      </div>

      <WeatherPanel jobId={job.id} />
    </div>
  );
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  Permit: 'Permit',
  Inspection: 'Inspection',
  LienWaiver: 'Lien waiver',
  SafetyIncident: 'Safety incident',
};

function ReadinessRow({ label, status }: { label: string; status: ComponentStatus }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1">
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
