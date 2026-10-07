import Link from 'next/link';
import { getDb } from '@/lib/db';
import { computeReadinessForJobs } from '@/lib/readiness-service';
import { StatusBadge } from '@/components/StatusBadge';
import type { ComponentStatus, ReadinessInputs, ReadinessResult } from '@/lib/domain/readiness';

export const dynamic = 'force-dynamic';

type Priority = 'critical' | 'attention' | 'planning';

type ActionItem = {
  key: string;
  priority: Priority;
  category: string;
  subject: string;
  detail: string;
  href: string;
  action: string;
};

const COMPONENT_LABEL: Record<keyof ReadinessInputs, string> = {
  crew: 'Crew',
  equipment: 'Equipment',
  compliance: 'Compliance',
  weather: 'Weather',
  permits: 'Permits & inspections',
};

const COMPONENT_ACTION: Record<keyof ReadinessInputs, string> = {
  crew: 'Review staffing',
  equipment: 'Review equipment',
  compliance: 'Review compliance',
  weather: 'Review job',
  permits: 'Review permits',
};

const PRIORITY_META: Record<Priority, { heading: string; description: string; status: ComponentStatus }> = {
  critical: {
    heading: 'Critical',
    description: 'Hard blockers that can stop planned work.',
    status: 'blocked',
  },
  attention: {
    heading: 'Needs attention',
    description: 'Warnings that need intervention before they become blockers.',
    status: 'warning',
  },
  planning: {
    heading: 'Planning',
    description: 'Incomplete or unresolved information that needs a management check.',
    status: 'unknown',
  },
};

export default async function ActionCentrePage() {
  const prisma = await getDb();
  const jobs = await prisma.job.findMany({
    where: { status: { in: ['ACTIVE', 'PLANNING'] } },
    orderBy: { startDate: 'asc' },
  });
  const readinessById = await computeReadinessForJobs(jobs.map((job) => job.id));
  const openWorkOrders = await prisma.workOrder.findMany({
    where: { status: { not: 'COMPLETED' } },
    include: { equipment: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const items: ActionItem[] = [];

  for (const job of jobs) {
    const readiness = readinessById.get(job.id);
    if (!readiness) continue;
    addReadinessActions(items, job, readiness);
  }

  for (const workOrder of openWorkOrders) {
    const down = workOrder.equipment.status === 'DOWN_FOR_SERVICE';
    items.push({
      key: `work-order-${workOrder.id}`,
      priority: down ? 'critical' : 'attention',
      category: 'Maintenance',
      subject: workOrder.equipment.name,
      detail: workOrder.description,
      href: `/equipment/${workOrder.equipment.id}`,
      action: 'Review work order',
    });
  }

  const grouped = {
    critical: items.filter((item) => item.priority === 'critical'),
    attention: items.filter((item) => item.priority === 'attention'),
    planning: items.filter((item) => item.priority === 'planning'),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Action Centre</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Management exceptions across active and upcoming work — blockers first, then warnings and unresolved planning
          items. Every action is derived from the same readiness rules used on the dashboard and job pages.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Critical blockers" value={grouped.critical.length} status="blocked" />
        <Summary label="Needs attention" value={grouped.attention.length} status="warning" />
        <Summary label="Planning reviews" value={grouped.planning.length} status="unknown" />
      </div>

      {(['critical', 'attention', 'planning'] as const).map((priority) => (
        <ActionSection key={priority} priority={priority} items={grouped[priority]} />
      ))}

      {items.length === 0 && (
        <div className="card text-center">
          <div className="font-semibold">No operational exceptions</div>
          <p className="mt-1 text-sm text-zinc-500">All active and upcoming work is currently clear of surfaced blockers and warnings.</p>
        </div>
      )}
    </div>
  );
}

function addReadinessActions(
  items: ActionItem[],
  job: { id: string; name: string },
  readiness: ReadinessResult,
) {
  const components: Array<keyof ReadinessInputs> = ['crew', 'equipment', 'compliance', 'permits', 'weather'];
  for (const component of components) {
    const status = readiness[component];
    if (status === 'ok') continue;
    const priority: Priority = status === 'blocked' ? 'critical' : status === 'warning' ? 'attention' : 'planning';
    items.push({
      key: `readiness-${job.id}-${component}`,
      priority,
      category: COMPONENT_LABEL[component],
      subject: job.name,
      detail: readiness.reasons?.[component] ?? fallbackReason(component, status),
      href: `/jobs/${job.id}`,
      action: COMPONENT_ACTION[component],
    });
  }
}

function fallbackReason(component: keyof ReadinessInputs, status: ComponentStatus): string {
  if (status === 'unknown') return `${COMPONENT_LABEL[component]} readiness has not been fully evaluated.`;
  return `${COMPONENT_LABEL[component]} readiness requires attention.`;
}

function Summary({ label, value, status }: { label: string; value: number; status: ComponentStatus }) {
  const valueClass =
    status === 'blocked' ? 'text-red-700' : status === 'warning' ? 'text-amber-700' : 'text-zinc-700';
  return (
    <div className="card">
      <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function ActionSection({ priority, items }: { priority: Priority; items: ActionItem[] }) {
  const meta = PRIORITY_META[priority];
  return (
    <section aria-labelledby={`actions-${priority}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`actions-${priority}`} className="text-lg font-semibold">{meta.heading}</h2>
          <p className="text-sm text-zinc-500">{meta.description}</p>
        </div>
        <StatusBadge status={meta.status} label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`} />
      </div>

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-outdoor-border bg-white shadow-sm">
          <div className="divide-y divide-outdoor-border">
            {items.map((item) => (
              <div key={item.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.category}</span>
                    <span className="font-semibold">{item.subject}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{item.detail}</p>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-md border border-outdoor-border px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                >
                  {item.action}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-outdoor-border px-4 py-5 text-sm text-zinc-500">
          No {meta.heading.toLowerCase()} items right now.
        </div>
      )}
    </section>
  );
}
