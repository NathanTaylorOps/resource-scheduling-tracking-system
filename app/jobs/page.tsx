import Link from 'next/link';
import { getDb } from '@/lib/db';
import { CreateJobForm } from '@/components/CreateJobForm';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETE: 'Complete',
};

export default async function JobsPage() {
  const prisma = getDb();
  const jobs = await prisma.job.findMany({ orderBy: { startDate: 'asc' } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
      <CreateJobForm />

      {/* Below sm: a table with five columns doesn't fit a phone screen, so
          this is a stacked card list instead of a clipped or sideways-
          scrolling table. */}
      <div className="space-y-3 sm:hidden">
        {jobs.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`} className="card block hover:border-zinc-400">
            <div className="font-semibold">{job.name}</div>
            <div className="text-sm text-zinc-500">{job.address}</div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <div className="text-zinc-400">Status</div>
                <div className="font-medium text-zinc-700">{STATUS_LABEL[job.status]}</div>
              </div>
              <div>
                <div className="text-zinc-400">Weather sensitivity</div>
                <div className="font-medium capitalize text-zinc-700">{job.weatherSensitivity.toLowerCase()}</div>
              </div>
              <div>
                <div className="text-zinc-400">Start</div>
                <div className="font-medium text-zinc-700">{job.startDate.toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-zinc-400">Target completion</div>
                <div className="font-medium text-zinc-700">{job.targetEndDate.toLocaleDateString()}</div>
              </div>
            </div>
          </Link>
        ))}
        {jobs.length === 0 && <p className="text-sm text-zinc-500">No jobs on file.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-outdoor-border shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Target completion</th>
              <th className="px-4 py-3">Weather sensitivity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outdoor-border bg-white">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-outdoor-surface">
                <td className="px-4 py-3">
                  <Link href={`/jobs/${job.id}`} className="font-medium text-zinc-900 hover:underline">
                    {job.name}
                  </Link>
                  <div className="text-xs text-zinc-500">{job.address}</div>
                </td>
                <td className="px-4 py-3">{STATUS_LABEL[job.status]}</td>
                <td className="px-4 py-3">{job.startDate.toLocaleDateString()}</td>
                <td className="px-4 py-3">{job.targetEndDate.toLocaleDateString()}</td>
                <td className="px-4 py-3 capitalize">{job.weatherSensitivity.toLowerCase()}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No jobs on file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
