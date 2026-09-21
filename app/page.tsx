import Link from 'next/link';
import { prisma } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { StatusBadge, OVERALL_READINESS_LABEL } from '@/components/StatusBadge';
import type { ComponentStatus } from '@/lib/domain/readiness';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { CircleCheck, TriangleAlert, CircleX, CircleHelp } from 'lucide-react';

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
              className="card flex flex-col gap-3 transition hover:border-zinc-400 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold">{job.name}</div>
                <div className="text-sm text-zinc-500">{job.address}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <ComponentPill label="Crew" status={readiness.crew} />
                <ComponentPill label="Equip." status={readiness.equipment} />
                <ComponentPill label="Compl." status={readiness.compliance} />
                <ComponentPill label="Weather" status={readiness.weather} />
                <ComponentPill label="Permits" status={readiness.permits} />
                <div className="sm:ml-3">
                  <StatusBadge status={readiness.overall} label={OVERALL_READINESS_LABEL[readiness.overall]} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Explicit per-status maps rather than a ternary chain — a ternary chain
// that only branches on 'ok' and 'warning' silently sends every other
// status (including a status added later, like 'unknown') down the same
// "must be blocked" fallback, which is exactly the kind of false-red (or,
// before 'unknown' existed here, false-green) misread this file's whole
// readiness design is built to avoid.
const PILL_ICON: Record<ComponentStatus, typeof CircleCheck> = {
  ok: CircleCheck,
  warning: TriangleAlert,
  blocked: CircleX,
  unknown: CircleHelp,
};
const PILL_ICON_CLASS: Record<ComponentStatus, string> = {
  ok: 'text-status-ok',
  warning: 'text-status-warning',
  blocked: 'text-status-blocked',
  unknown: 'text-zinc-400',
};
function ComponentPill({ label, status }: { label: string; status: ComponentStatus }) {
  const Icon = PILL_ICON[status];
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-outdoor-border px-2 py-1 text-xs text-zinc-600">
      <Icon className={`h-3 w-3 ${PILL_ICON_CLASS[status]}`} aria-hidden="true" />
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
  // Matches the tile's own label exactly: 'expiring_soon' and 'expired' are
  // the two statuses that actually mean "due soon or expired." 'aging' (an
  // INFORMAL_RECENCY card past its informal window) and 'renewal_pending' (a
  // GRACE_PERIOD renewal filed on time) are deliberately excluded — neither
  // is a problem needing the same attention, and lumping them in here would
  // make this count claim more than it means.
  return certs.filter((c) => {
    const { status } = getCertificationStatus(c.expiryDate, now, undefined, c.renewalPattern, c.renewalFiledDate);
    return status === 'expiring_soon' || status === 'expired';
  }).length;
}
