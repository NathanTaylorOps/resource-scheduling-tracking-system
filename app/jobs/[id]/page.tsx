import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { findOverlaps, type Assignment as OverlapAssignment } from '@/lib/domain/scheduling';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { StatusBadge } from '@/components/StatusBadge';
import { WeatherPanel } from '@/components/WeatherPanel';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      assignments: { include: { worker: { include: { certifications: true } } }, orderBy: { start: 'asc' } },
    },
  });
  if (!job) notFound();

  const equipment = await prisma.equipment.findMany({
    where: { currentJobId: job.id },
    include: { compliance: true },
  });

  const readiness = await computeJobReadiness(job.id);

  const workerIds = [...new Set(job.assignments.map((a) => a.workerId))];
  const allAssignments = workerIds.length
    ? await prisma.assignment.findMany({ where: { workerId: { in: workerIds } } })
    : [];
  const overlapInput: OverlapAssignment[] = allAssignments.map((a) => ({ id: a.id, workerId: a.workerId, jobId: a.jobId, start: a.start, end: a.end }));
  const conflicts = findOverlaps(overlapInput).filter((c) => c.first.jobId === job.id || c.second.jobId === job.id);

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
          ← Jobs
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <p className="text-sm text-zinc-500">{job.address}</p>
          </div>
          <StatusBadge status={readiness.overall} label={readiness.overall === 'ok' ? 'Ready' : readiness.overall === 'warning' ? 'Needs attention' : 'Blocked'} />
        </div>
      </div>

      {/* Readiness breakdown — decomposed, never a single opaque score */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Readiness breakdown</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReadinessRow label="Crew" status={readiness.crew} />
          <ReadinessRow label="Equipment" status={readiness.equipment} />
          <ReadinessRow label="Compliance" status={readiness.compliance} />
          <ReadinessRow label="Weather" status={readiness.weather} />
        </div>
        {conflicts.length > 0 && (
          <p className="mt-3 text-sm text-red-700">
            Scheduling conflict: {conflicts.map((c) => c.first.workerId).join(', ')} — a crew member on this job is
            also booked on another job during an overlapping window.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Crew */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Crew assigned</h2>
          <ul className="divide-y divide-outdoor-border">
            {job.assignments.map((a) => {
              const expiredOrSoon = a.worker.certifications.filter(
                (c) => getCertificationStatus(c.expiryDate, now).status !== 'valid',
              );
              return (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link href={`/workers/${a.worker.id}`} className="font-medium hover:underline">
                      {a.worker.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {a.roleOnJob} · {a.start.toLocaleDateString()} – {a.end.toLocaleDateString()}
                    </div>
                  </div>
                  {expiredOrSoon.length > 0 && (
                    <span className="text-xs font-medium text-amber-700">{expiredOrSoon.length} cert{expiredOrSoon.length > 1 ? 's' : ''} to review</span>
                  )}
                </li>
              );
            })}
            {job.assignments.length === 0 && <p className="py-2 text-sm text-zinc-500">No crew assigned yet.</p>}
          </ul>
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
