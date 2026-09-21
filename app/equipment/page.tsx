import Link from 'next/link';
import { prisma } from '@/lib/db';
import { resolveCounterValue } from '@/lib/readiness-service';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  IDLE: 'Idle',
  IN_TRANSIT: 'In transit',
  DOWN_FOR_SERVICE: 'Down for service',
  RETIRED: 'Retired',
};

export default async function EquipmentPage() {
  const equipment = await prisma.equipment.findMany({
    include: { compliance: true, lifeCounters: true },
    orderBy: { name: 'asc' },
  });
  const jobs = await prisma.job.findMany({ select: { id: true, name: true } });
  const jobNameById = new Map(jobs.map((j) => [j.id, j.name]));
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
        <Link href="/equipment/scan" className="field-btn bg-zinc-900 text-white hover:bg-zinc-800">
          Scan QR
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-outdoor-border">
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
            {equipment.map((item) => {
              const worst = item.compliance.reduce<'ok' | 'warning' | 'blocked'>((acc, c) => {
                const currentValue = resolveCounterValue(c.counterType, item, now);
                if (currentValue === null) return acc;
                const status = getComplianceStatus(
                  { unit: c.counterType, intervalValue: c.intervalValue, toleranceValue: c.toleranceValue, hardLimit: c.hardLimit, dueValue: c.dueValue },
                  currentValue,
                  14,
                ).status;
                if (status === 'overdue') return 'blocked';
                if ((status === 'due_soon' || status === 'in_tolerance') && acc !== 'blocked') return 'warning';
                return acc;
              }, 'ok');

              return (
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
                  <td className="px-4 py-3">
                    {item.currentJobId ? jobNameById.get(item.currentJobId) ?? 'Unknown job' : item.locationNote ?? 'In storage'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={worst} label={worst === 'ok' ? 'Current' : worst === 'warning' ? 'Due soon' : 'Overdue'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
