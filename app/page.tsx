import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { StatusBadge } from '@/components/StatusBadge';
import type { ComponentStatus } from '@/lib/domain/readiness';
import { getCertificationStatus } from '@/lib/domain/certifications';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const jobs = await prisma.job.findMany({
    where: { status: { in: ['ACTIVE', 'PLANNING'] } },
    orderBy: { startDate: 'asc' },
  });

  const readinessByJob = await Promise.all(
    jobs.map(async (job) => ({ job, readiness: await computeJobReadiness(job.id) })),
  );

  const dueSoonCerts = await getDueSoonCertCount();
  const openWorkOrders = await prisma.workOrder.count({ where: { status: { not: 'COMPLETED' } } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Coastwood Builders — {jobs.length} active or upcoming jobs
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile label="Jobs at risk" value={readinessByJob.filter((r) => r.readiness.overall !== 'ok').length} tone="warning" />
        <SummaryTile label="Certifications due soon or expired" value={dueSoonCerts} tone="warning" />
        <SummaryTile label="Open work orders" value={openWorkOrders} tone="neutral" />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Job readiness</h2>
        <div className="space-y-3">
          {readinessByJob.map(({ job, readiness }) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card flex items-center justify-between transition hover:border-zinc-400"
            >
              <div>
                <div className="font-semibold">{job.name}</div>
                <div className="text-sm text-zinc-500">{job.address}</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ComponentPill label="Crew" status={readiness.crew} />
                <ComponentPill label="Equip." status={readiness.equipment} />
                <ComponentPill label="Compl." status={readiness.compliance} />
                <ComponentPill label="Weather" status={readiness.weather} />
                <ComponentPill label="Permits" status={readiness.permits} />
                <div className="ml-3">
                  <StatusBadge status={readiness.overall} label={readiness.overall === 'ok' ? 'Ready' : readiness.overall === 'warning' ? 'Attention' : 'Blocked'} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComponentPill({ label, status }: { label: string; status: ComponentStatus }) {
  const dotClass = status === 'ok' ? 'bg-status-ok' : status === 'warning' ? 'bg-status-warning' : 'bg-status-blocked';
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-outdoor-border px-2 py-1 text-xs text-zinc-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'warning' | 'neutral' }) {
  return (
    <div className="card">
      <div className="text-3xl font-bold">{value}</div>
      <div className={`mt-1 text-sm ${tone === 'warning' && value > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>{label}</div>
    </div>
  );
}

async function getDueSoonCertCount(): Promise<number> {
  const now = new Date();
  const certs = await prisma.workerCertification.findMany();
  return certs.filter((c) => getCertificationStatus(c.expiryDate, now).status !== 'valid').length;
}
