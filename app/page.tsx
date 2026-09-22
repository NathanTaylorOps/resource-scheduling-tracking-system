import Link from 'next/link';
import { getDb } from '@/lib/db';
import { computeJobReadiness } from '@/lib/readiness-service';
import { StatusBadge, OVERALL_READINESS_LABEL } from '@/components/StatusBadge';
import type { ComponentStatus, ReadinessResult } from '@/lib/domain/readiness';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { CircleCheck, TriangleAlert, CircleX, CircleHelp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const prisma = getDb();
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
        <SummaryTile
          label="Certifications due soon or expired"
          value={dueSoonCerts}
          tone="warning"
          href="/expiring"
        />
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
                {/* The specific reason for whichever component is worst —
                    without this, "Blocked"/"Attention" on this summary
                    screen meant clicking into the job to find out why. */}
                {worstReason(readiness) && (
                  <div className="mt-1 text-xs text-zinc-600">{worstReason(readiness)}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <ComponentPill label="Crew" status={readiness.crew} reason={readiness.reasons?.crew} />
                <ComponentPill label="Equip." status={readiness.equipment} reason={readiness.reasons?.equipment} />
                <ComponentPill label="Compl." status={readiness.compliance} reason={readiness.reasons?.compliance} />
                <ComponentPill label="Weather" status={readiness.weather} reason={readiness.reasons?.weather} />
                <ComponentPill label="Permits" status={readiness.permits} reason={readiness.reasons?.permits} />
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
function ComponentPill({ label, status, reason }: { label: string; status: ComponentStatus; reason?: string }) {
  const Icon = PILL_ICON[status];
  const title = reason ?? `${label.replace('.', '')}: ${status === 'ok' ? 'OK' : status}`;
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-outdoor-border px-2 py-1 text-xs text-zinc-600"
      title={title}
    >
      <Icon className={`h-3 w-3 ${PILL_ICON_CLASS[status]}`} aria-hidden="true" />
      {label}
    </div>
  );
}

// Picks out the reason for whichever component readiness.overall actually
// reflects, so the one-line caption under a job's address always matches
// the badge next to it — rather than, say, always showing the compliance
// reason even on a job that's actually blocked by permits.
const SEVERITY_FOR_DISPLAY: Record<ComponentStatus, number> = { ok: 0, unknown: 1, warning: 1, blocked: 2 };
function worstReason(readiness: ReadinessResult): string | undefined {
  if (readiness.overall === 'ok' || !readiness.reasons) return undefined;
  const components: Array<keyof typeof readiness.reasons> = ['crew', 'equipment', 'compliance', 'weather', 'permits'];
  let worst: string | undefined;
  let worstSeverity = -1;
  for (const key of components) {
    const status = readiness[key];
    const severity = SEVERITY_FOR_DISPLAY[status];
    if (severity > worstSeverity && readiness.reasons[key]) {
      worst = readiness.reasons[key];
      worstSeverity = severity;
    }
  }
  return worst;
}

function SummaryTile({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'neutral';
  href?: string;
}) {
  const content = (
    <>
      <div className="text-3xl font-bold">{value}</div>
      <div className={`mt-1 text-sm ${tone === 'warning' && value > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>{label}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block transition hover:border-zinc-400">
        {content}
      </Link>
    );
  }
  return <div className="card">{content}</div>;
}

async function getDueSoonCertCount(): Promise<number> {
  const prisma = getDb();
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
