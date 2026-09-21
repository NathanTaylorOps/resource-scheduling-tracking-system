import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { findOverlaps, findUnfilledRoles, type Assignment as OverlapAssignment } from '@/lib/domain/scheduling';
import { findEquipmentConflicts } from '@/lib/domain/equipment';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { StatusBadge } from '@/components/StatusBadge';
import { WeatherPanel } from '@/components/WeatherPanel';
import { JobRequirementsEditor } from '@/components/JobRequirementsEditor';
import { AssignWorkerForm } from '@/components/AssignWorkerForm';
import { PermitsEditor } from '@/components/PermitsEditor';
import { DailyLogForm } from '@/components/DailyLogForm';
import { ToolboxTalkForm } from '@/components/ToolboxTalkForm';
import { ToolboxTalkList } from '@/components/ToolboxTalkList';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
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

  // Today's log, if there is one — DailyLog's one-per-job-per-day constraint
  // means this is the record the log form below edits in place rather than
  // trying (and 409-ing) to create a second one for today.
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysLog = dailyLogs.find((log) => log.logDate.toISOString().slice(0, 10) === todayKey) ?? null;

  // The crew list both the daily-log and toolbox-talk forms below draw
  // their worker pickers from — whoever's actually assigned to this job,
  // deduplicated the same way workerNameById above already does.
  const crewOnJob = [...new Map(job.assignments.map((a) => [a.worker.id, { id: a.worker.id, name: a.worker.name }])).values()];

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
              // separate.
              const expiredCerts = certStatuses.filter((s) => s === 'expired').length;
              const toReviewCerts = certStatuses.filter(
                (s) => s === 'expiring_soon' || s === 'aging' || s === 'renewal_pending',
              ).length;
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

      <WeatherPanel jobId={job.id} />
    </div>
  );
}

function ReadinessRow({ label, status }: { label: string; status: 'ok' | 'warning' | 'blocked' }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1">
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
