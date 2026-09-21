import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { calculateUtilization } from '@/lib/domain/scheduling';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function WorkerDetailPage({ params }: { params: { id: string } }) {
  const worker = await prisma.worker.findUnique({
    where: { id: params.id },
    include: {
      certifications: { orderBy: { expiryDate: 'asc' } },
      assignments: { include: { job: true }, orderBy: { start: 'desc' } },
    },
  });
  if (!worker) notFound();

  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const utilization = calculateUtilization({
    assignments: worker.assignments.map((a) => ({ id: a.id, workerId: a.workerId, jobId: a.jobId, start: a.start, end: a.end })),
    periodStart,
    periodEnd: now,
  });

  return (
    <div className="space-y-6">
      <Link href="/workers" className="text-sm text-zinc-500 hover:underline">
        ← Crew
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{worker.name}</h1>
        <p className="text-sm text-zinc-500">
          {worker.trade} · {worker.employmentType === 'DIRECT_EMPLOYEE' ? 'Direct employee' : 'Subcontractor'} · with
          Coastwood since {worker.hireDate.toLocaleDateString()}
        </p>
      </div>

      <div className="card w-fit">
        <div className="text-xs text-zinc-500">Utilization, trailing 30 days</div>
        <div className="text-3xl font-bold">{Math.round(utilization * 100)}%</div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Certifications</h2>
        <ul className="divide-y divide-outdoor-border">
          {worker.certifications.map((cert) => {
            const status = getCertificationStatus(cert.expiryDate, now);
            return (
              <li key={cert.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{cert.certType}</div>
                  <div className="text-xs text-zinc-500">
                    {cert.issuingBody} · expires {cert.expiryDate.toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge
                  status={status.status === 'expired' ? 'blocked' : status.status === 'expiring_soon' ? 'warning' : 'ok'}
                  label={status.status === 'expired' ? `Expired ${Math.abs(status.daysUntilExpiry)}d ago` : status.status === 'expiring_soon' ? `Due in ${status.daysUntilExpiry}d` : 'Current'}
                />
              </li>
            );
          })}
          {worker.certifications.length === 0 && <p className="py-2 text-sm text-zinc-500">No certifications on file.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Assignment history</h2>
        <ul className="divide-y divide-outdoor-border">
          {worker.assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/jobs/${a.job.id}`} className="font-medium hover:underline">
                  {a.job.name}
                </Link>
                <div className="text-xs text-zinc-500">{a.roleOnJob}</div>
              </div>
              <div className="text-xs text-zinc-500">
                {a.start.toLocaleDateString()} – {a.end.toLocaleDateString()}
              </div>
            </li>
          ))}
          {worker.assignments.length === 0 && <p className="py-2 text-sm text-zinc-500">No assignments on file.</p>}
        </ul>
      </div>
    </div>
  );
}
