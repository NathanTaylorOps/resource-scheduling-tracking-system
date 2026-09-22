import Link from 'next/link';
import { getDb } from '@/lib/db';
import { JobStatus } from '@/lib/enums';
import { computeJobReadiness } from '@/lib/readiness-service';
import { JobMapLoader } from '@/components/JobMapLoader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const prisma = getDb();
  const jobs = await prisma.job.findMany({
    where: { status: { in: [JobStatus.PLANNING, JobStatus.ACTIVE] } },
    orderBy: { name: 'asc' },
  });

  const jobsWithReadiness = await Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      name: job.name,
      address: job.address,
      latitude: job.latitude,
      longitude: job.longitude,
      overall: (await computeJobReadiness(job.id)).overall,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Site map</h1>
        <p className="mt-1 text-sm text-zinc-500">Every active or upcoming job, colored by overall readiness.</p>
      </div>

      <JobMapLoader jobs={jobsWithReadiness} />

      <div className="card">
        <h2 className="mb-3 font-semibold">Jobs on this map</h2>
        <ul className="divide-y divide-outdoor-border">
          {jobsWithReadiness.map((job) => (
            <li key={job.id} className="flex items-center justify-between py-2">
              <Link href={`/jobs/${job.id}`} className="text-sm font-medium hover:underline">
                {job.name}
              </Link>
              <StatusBadge
                status={job.overall}
                label={job.overall === 'ok' ? 'Ready' : job.overall === 'warning' ? 'Attention' : 'Blocked'}
              />
            </li>
          ))}
          {jobsWithReadiness.length === 0 && <p className="py-2 text-sm text-zinc-500">No active or upcoming jobs.</p>}
        </ul>
      </div>
    </div>
  );
}
