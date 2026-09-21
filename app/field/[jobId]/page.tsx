import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { computeJobReadiness, DUE_SOON_WINDOW_DAYS, DAY_MS } from '@/lib/readiness-service';
import { getCertificationStatus, summarizeCertificationStatuses } from '@/lib/domain/certifications';
import { permitsStatusFrom } from '@/lib/domain/readiness';
import { isPastCalendarDate } from '@/lib/domain/dates';
import { StatusBadge, OVERALL_READINESS_LABEL } from '@/components/StatusBadge';
import { DailyLogForm } from '@/components/DailyLogForm';
import { ToolboxTalkForm } from '@/components/ToolboxTalkForm';
import { ChevronLeft, CircleCheck, TriangleAlert, CircleX } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * The single-job, mobile-first slice the README's roadmap describes: today's
 * crew, equipment, and permit status for the one job someone is standing
 * on, plus the two quick-add actions (daily log, toolbox talk) that matter
 * most from the field — fast enough to use one-handed, not the full GM
 * cross-job detail view at /jobs/[id].
 */
export default async function FieldJobPage({ params }: { params: { jobId: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    include: { assignments: { include: { worker: { include: { certifications: true } } }, orderBy: { roleOnJob: 'asc' } } },
  });
  if (!job) notFound();

  const now = new Date();
  // Same-day lookup by the compound unique key, rather than fetching and
  // filtering every log — DailyLog is one-per-job-per-day, so this either
  // finds today's entry or confirms there isn't one yet.
  const todaysLogDate = new Date(now.toISOString().slice(0, 10));
  const [readiness, equipment, permits, todaysLog] = await Promise.all([
    computeJobReadiness(job.id),
    prisma.equipment.findMany({ where: { currentJobId: job.id } }),
    prisma.permit.findMany({ where: { jobId: job.id }, include: { inspections: true } }),
    prisma.dailyLog.findUnique({ where: { jobId_logDate: { jobId: job.id, logDate: todaysLogDate } } }),
  ]);

  const crew = [...new Map(job.assignments.map((a) => [a.worker.id, { id: a.worker.id, name: a.worker.name }])).values()];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/field" className="flex items-center gap-1 text-sm text-zinc-500 hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Field view
        </Link>
        <Link href={`/jobs/${job.id}`} className="text-sm text-zinc-500 hover:underline">
          Full detail →
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
          <p className="text-sm text-zinc-500">{job.address}</p>
        </div>
        <StatusBadge status={readiness.overall} label={OVERALL_READINESS_LABEL[readiness.overall]} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Crew today</h2>
        <ul className="divide-y divide-outdoor-border">
          {job.assignments.map((a) => {
            const statuses = a.worker.certifications.map(
              (c) => getCertificationStatus(c.expiryDate, now, undefined, c.renewalPattern, c.renewalFiledDate).status,
            );
            // Same shared bucketing the job detail page uses (see
            // lib/domain/certifications.ts) — just collapsed to booleans
            // here since this view shows one icon, not a count.
            const { expiredCount, reviewCount } = summarizeCertificationStatuses(statuses);
            const hasExpired = expiredCount > 0;
            const hasReview = reviewCount > 0;
            const Icon = hasExpired ? CircleX : hasReview ? TriangleAlert : CircleCheck;
            const iconClass = hasExpired ? 'text-status-blocked' : hasReview ? 'text-status-warning' : 'text-status-ok';
            return (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <Link href={`/workers/${a.worker.id}`} className="font-medium hover:underline">
                    {a.worker.name}
                  </Link>
                  <div className="text-xs text-zinc-500">{a.roleOnJob}</div>
                </div>
                <Icon className={`h-5 w-5 ${iconClass}`} aria-label={hasExpired ? 'Certification expired' : hasReview ? 'Certification to review' : 'Certifications current'} />
              </li>
            );
          })}
          {job.assignments.length === 0 && <p className="py-2 text-sm text-zinc-500">No crew assigned yet.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Equipment on site</h2>
        <ul className="divide-y divide-outdoor-border">
          {equipment.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2.5">
              <Link href={`/equipment/${e.id}`} className="font-medium hover:underline">
                {e.name}
              </Link>
              <span className={`text-xs font-medium ${e.status === 'DOWN_FOR_SERVICE' ? 'text-status-blocked' : 'text-zinc-500'}`}>
                {e.status.replace(/_/g, ' ').toLowerCase()}
              </span>
            </li>
          ))}
          {equipment.length === 0 && <p className="py-2 text-sm text-zinc-500">No equipment on site.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Permits</h2>
        <ul className="divide-y divide-outdoor-border">
          {permits.map((p) => {
            // Same three inputs, and the same permitsStatusFrom function,
            // that the overall readiness banner above is built from — so
            // this row can never show "ok" for a permit that's the reason
            // the banner at the top of this same screen reads "Attention."
            // (An earlier version of this page recomputed isExpired/
            // hasFailedInspection inline and left out the due-soon
            // inspection check entirely, which is exactly how that
            // mismatch happened.)
            const isExpired = p.status === 'EXPIRED' || (p.expiryDate !== null && isPastCalendarDate(p.expiryDate, now));
            const hasFailedInspection = p.inspections.some((i) => i.status === 'FAILED');
            const hasInspectionDueSoon = p.inspections.some(
              (i) =>
                i.status === 'SCHEDULED' &&
                i.scheduledDate !== null &&
                i.scheduledDate.getTime() >= now.getTime() &&
                i.scheduledDate.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * DAY_MS,
            );
            const status = permitsStatusFrom({ hasFailedInspection, hasExpiredPermit: isExpired, hasInspectionDueSoon });
            const label = isExpired
              ? 'Expired'
              : hasFailedInspection
                ? 'Failed inspection'
                : hasInspectionDueSoon
                  ? 'Inspection due soon'
                  : p.status.charAt(0) + p.status.slice(1).toLowerCase();
            return (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium">{p.permitType.charAt(0) + p.permitType.slice(1).toLowerCase()}</span>
                <StatusBadge status={status} label={label} />
              </li>
            );
          })}
          {permits.length === 0 && <p className="py-2 text-sm text-zinc-500">No permits filed for this job.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Log the day</h2>
        <DailyLogForm
          jobId={job.id}
          crew={crew}
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
        <ToolboxTalkForm jobId={job.id} crew={crew} />
      </div>
    </div>
  );
}
