import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { StatusBadge, OVERALL_READINESS_LABEL } from '@/components/StatusBadge';
import { JobStatus } from '@/lib/enums';

export const dynamic = 'force-dynamic';

/**
 * Job picker for the field view — the one screen before /field/[jobId].
 * Deliberately separate from the dashboard: this list shows nothing but a
 * name, address, and overall status in large tappable rows, because the
 * person reaching for this from a truck already knows which job they're
 * on and just needs to get there in one thumb-tap, not scan five readiness
 * components to find it.
 */
export default async function FieldJobPickerPage() {
  const jobs = await prisma.job.findMany({
    where: { status: { in: [JobStatus.PLANNING, JobStatus.ACTIVE] } },
    orderBy: { name: 'asc' },
  });
  const readinessByJob = await Promise.all(
    jobs.map(async (job) => ({ job, readiness: await computeJobReadiness(job.id) })),
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Field view</h1>
        <p className="mt-1 text-sm text-zinc-500">Pick your job — today's crew, equipment, and permit status, and quick actions to log the day.</p>
      </div>
      <div className="space-y-3">
        {readinessByJob.map(({ job, readiness }) => (
          <Link
            key={job.id}
            href={`/field/${job.id}`}
            className="field-btn card flex items-center justify-between gap-3 hover:border-zinc-400"
          >
            <span className="text-left">
              <span className="block text-base font-semibold">{job.name}</span>
              <span className="block text-sm font-normal text-zinc-500">{job.address}</span>
            </span>
            <StatusBadge status={readiness.overall} label={OVERALL_READINESS_LABEL[readiness.overall]} />
          </Link>
        ))}
        {readinessByJob.length === 0 && <p className="py-2 text-sm text-zinc-500">No active or upcoming jobs.</p>}
      </div>
    </div>
  );
}
