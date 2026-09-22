import Link from 'next/link';
import { getDb } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { StatusBadge, OVERALL_READINESS_LABEL } from '@/components/StatusBadge';
import type { ComponentStatus } from '@/lib/domain/readiness';

export const dynamic = 'force-dynamic';

const UNASSIGNED_DIVISION = 'Unassigned';

const OVERALL_STATUSES: ComponentStatus[] = ['ok', 'warning', 'blocked', 'unknown'];

interface JobWithReadiness {
  id: string;
  name: string;
  address: string;
  division: string | null;
  overall: ComponentStatus;
}

/**
 * Cross-job rollup by `Job.division` — for someone overseeing a whole
 * portfolio (a COO, a regional Project Executive) rather than one job at a
 * time. Everything the dashboard and jobs list already compute per job
 * (computeJobReadiness) is reused here; the only new work is grouping by
 * division and counting each group's readiness mix.
 */
export default async function PortfolioPage() {
  const prisma = getDb();
  const jobs = await prisma.job.findMany({ orderBy: { name: 'asc' } });

  const jobsWithReadiness: JobWithReadiness[] = await Promise.all(
    jobs.map(async (job) => {
      const readiness = await computeJobReadiness(job.id);
      return { id: job.id, name: job.name, address: job.address, division: job.division, overall: readiness.overall };
    }),
  );

  const groups = new Map<string, JobWithReadiness[]>();
  for (const job of jobsWithReadiness) {
    const key = job.division ?? UNASSIGNED_DIVISION;
    const existing = groups.get(key);
    if (existing) existing.push(job);
    else groups.set(key, [job]);
  }

  // Unassigned last, real divisions alphabetical before it — a division
  // name is a real fact about a job; "no division set" is a data gap, not
  // a peer grouping, so it reads better anchored at the end than sorted in
  // among real names.
  const sortedDivisions = [...groups.keys()].sort((a, b) => {
    if (a === UNASSIGNED_DIVISION) return 1;
    if (b === UNASSIGNED_DIVISION) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A cross-job rollup by division, for whoever&apos;s overseeing several jobs at once rather than working one.
        </p>
      </div>

      {sortedDivisions.map((division) => {
        const divisionJobs = groups.get(division)!;
        const counts: Record<ComponentStatus, number> = { ok: 0, warning: 0, blocked: 0, unknown: 0 };
        for (const job of divisionJobs) counts[job.overall] += 1;

        return (
          <div key={division} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{division}</h2>
              <span className="text-xs text-zinc-500">
                {divisionJobs.length} job{divisionJobs.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OVERALL_STATUSES.map((status) => (
                <div key={status} className="card">
                  <div className="text-3xl font-bold">{counts[status]}</div>
                  <div className="mt-1 text-sm text-zinc-500">{OVERALL_READINESS_LABEL[status]}</div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-outdoor-border sm:block">
              <table className="w-full text-sm">
                <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Readiness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outdoor-border bg-white">
                  {divisionJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-outdoor-surface">
                      <td className="px-4 py-3">
                        <Link href={`/jobs/${job.id}`} className="font-medium text-zinc-900 hover:underline">
                          {job.name}
                        </Link>
                        <div className="text-xs text-zinc-500">{job.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.overall} label={OVERALL_READINESS_LABEL[job.overall]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 sm:hidden">
              {divisionJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="card block hover:border-zinc-400">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{job.name}</div>
                      <div className="text-sm text-zinc-500">{job.address}</div>
                    </div>
                    <StatusBadge status={job.overall} label={OVERALL_READINESS_LABEL[job.overall]} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {sortedDivisions.length === 0 && <p className="text-sm text-zinc-500">No jobs on file.</p>}
    </div>
  );
}
