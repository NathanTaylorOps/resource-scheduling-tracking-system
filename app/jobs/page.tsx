import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETE: 'Complete',
};

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({ orderBy: { startDate: 'asc' } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
      <div className="overflow-hidden rounded-lg border border-outdoor-border">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
