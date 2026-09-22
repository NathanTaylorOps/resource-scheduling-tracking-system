import Link from 'next/link';
import { getDb } from '@/lib/db';
import { resolveCounterValue, resolveDueSoonWindow } from '@/lib/readiness-service';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { StatusBadge } from '@/components/StatusBadge';
import { CreateEquipmentForm } from '@/components/CreateEquipmentForm';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  IDLE: 'Idle',
  IN_TRANSIT: 'In transit',
  DOWN_FOR_SERVICE: 'Down for service',
  RETIRED: 'Retired',
};

// Prefixed rather than a bare "Overdue"/"Due soon"/"Current" — sitting
// right next to the operational Status column (which can itself read "Down
// for service"), an unprefixed compliance badge reads as ambiguous: is
// "Overdue" about the repair, or about calibration/inspection standing?
// Compliance here always means the fixed-interval calibration, inspection,
// warranty, and preventive-maintenance items tracked in
// EquipmentCompliance/MaintenancePlan — never the operational status next
// to it.
const COMPLIANCE_LABEL: Record<'ok' | 'warning' | 'blocked', string> = {
  ok: 'Compliance current',
  warning: 'Compliance due soon',
  blocked: 'Compliance overdue',
};

export default async function EquipmentPage() {
  const prisma = getDb();
  const equipment = await prisma.equipment.findMany({
    include: { compliance: true, lifeCounters: true },
    orderBy: { name: 'asc' },
  });
  const jobs = await prisma.job.findMany({ select: { id: true, name: true } });
  const jobNameById = new Map(jobs.map((j) => [j.id, j.name]));
  const now = new Date();

  // Computed once per asset and reused by both the mobile card list and the
  // desktop table below, rather than recomputing the same compliance sweep
  // twice for two different layouts of the same data.
  const rows = equipment.map((item) => {
    const worst = item.compliance.reduce<'ok' | 'warning' | 'blocked'>((acc, c) => {
      const currentValue = resolveCounterValue(c.counterType, item, now);
      if (currentValue === null) return acc;
      const status = getComplianceStatus(
        { unit: c.counterType, intervalValue: c.intervalValue, toleranceValue: c.toleranceValue, hardLimit: c.hardLimit, dueValue: c.dueValue },
        currentValue,
        resolveDueSoonWindow(c.counterType),
      ).status;
      if (status === 'overdue') return 'blocked';
      if ((status === 'due_soon' || status === 'in_tolerance') && acc !== 'blocked') return 'warning';
      return acc;
    }, 'ok');
    const location = item.currentJobId ? jobNameById.get(item.currentJobId) ?? 'Unknown job' : item.locationNote ?? 'In storage';
    return { item, worst, location };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
        <Link href="/equipment/scan" className="field-btn inline-flex w-fit bg-zinc-900 text-white hover:bg-zinc-800">
          Scan QR
        </Link>
      </div>
      <CreateEquipmentForm />

      {/* Below sm: a table with five columns doesn't fit a phone screen, so
          this is a stacked card list instead of a clipped or sideways-
          scrolling table. */}
      <div className="space-y-3 sm:hidden">
        {rows.map(({ item, worst, location }) => (
          <Link key={item.id} href={`/equipment/${item.id}`} className="card block hover:border-zinc-400">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-xs text-zinc-500">{item.qrCode}</div>
              </div>
              <StatusBadge status={worst} label={COMPLIANCE_LABEL[worst]} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <div className="text-zinc-400">Category</div>
                <div className="font-medium text-zinc-700">{item.category}</div>
              </div>
              <div>
                <div className="text-zinc-400">Status</div>
                <div className={`font-medium ${item.status === 'DOWN_FOR_SERVICE' ? 'text-red-700' : 'text-zinc-700'}`}>
                  {STATUS_LABEL[item.status]}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-zinc-400">Location</div>
                <div className="font-medium text-zinc-700">{location}</div>
              </div>
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-sm text-zinc-500">No equipment on file.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-outdoor-border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outdoor-border bg-white">
            {rows.map(({ item, worst, location }) => (
              <tr key={item.id} className="hover:bg-outdoor-surface">
                <td className="px-4 py-3">
                  <Link href={`/equipment/${item.id}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <div className="text-xs text-zinc-500">{item.qrCode}</div>
                </td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3">
                  <span className={item.status === 'DOWN_FOR_SERVICE' ? 'font-medium text-red-700' : ''}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3">{location}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={worst} label={COMPLIANCE_LABEL[worst]} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No equipment on file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
