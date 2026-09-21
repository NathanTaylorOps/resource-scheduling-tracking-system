import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
  const workers = await prisma.worker.findMany({
    include: { certifications: true },
    orderBy: { name: 'asc' },
  });
  const now = new Date();

  // Computed once per worker and reused by both layouts below.
  const rows = workers.map((worker) => {
    const statuses = worker.certifications.map(
      (c) => getCertificationStatus(c.expiryDate, now, undefined, c.renewalPattern, c.renewalFiledDate).status,
    );
    const worst = statuses.includes('expired')
      ? 'blocked'
      : statuses.includes('expiring_soon') || statuses.includes('aging') || statuses.includes('renewal_pending')
        ? 'warning'
        : 'ok';
    return { worker, worst };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Crew</h1>
        <Link href="/subcontractors" className="text-sm text-zinc-500 hover:underline">
          Subcontractor firms →
        </Link>
      </div>

      {/* Below sm: a table with four columns doesn't fit a phone screen, so
          this is a stacked card list instead of a clipped or sideways-
          scrolling table. */}
      <div className="space-y-3 sm:hidden">
        {rows.map(({ worker, worst }) => (
          <Link key={worker.id} href={`/workers/${worker.id}`} className="card block hover:border-zinc-400">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{worker.name}</span>
              <StatusBadge
                status={worst}
                label={worst === 'ok' ? 'All current' : worst === 'warning' ? 'Review needed' : 'Expired cert'}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {worker.trade} · {worker.employmentType === 'DIRECT_EMPLOYEE' ? 'Direct employee' : 'Subcontractor'}
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-sm text-zinc-500">No crew on file.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-outdoor-border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Certification status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outdoor-border bg-white">
            {rows.map(({ worker, worst }) => (
              <tr key={worker.id} className="hover:bg-outdoor-surface">
                <td className="px-4 py-3">
                  <Link href={`/workers/${worker.id}`} className="font-medium hover:underline">
                    {worker.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{worker.trade}</td>
                <td className="px-4 py-3">{worker.employmentType === 'DIRECT_EMPLOYEE' ? 'Direct employee' : 'Subcontractor'}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={worst}
                    label={worst === 'ok' ? 'All current' : worst === 'warning' ? 'Review needed' : 'Expired cert'}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No crew on file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
