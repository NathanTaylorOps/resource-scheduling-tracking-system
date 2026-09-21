import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveCounterValue, toDomainPlan } from '@/lib/readiness-service';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { computeDailyUsageRate, forecastDaysUntilDue } from '@/lib/domain/forecasting';
import { excludeCoveredChildren } from '@/lib/domain/maintenance';
import { findEquipmentConflicts } from '@/lib/domain/equipment';
import { StatusBadge } from '@/components/StatusBadge';
import { WorkOrderCompleteButton } from '@/components/WorkOrderCompleteButton';
import { generateEquipmentQrDataUrl } from '@/lib/qr';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const equipment = await prisma.equipment.findFirst({
    where: { OR: [{ id: params.id }, { qrCode: params.id }] },
    include: {
      compliance: true,
      lifeCounters: true,
      maintenancePlans: true,
      workOrders: { orderBy: { createdAt: 'desc' } },
      scanEvents: { orderBy: { timestamp: 'desc' }, take: 10, include: { photos: true, scannedBy: true, job: true } },
      reservations: { orderBy: { start: 'asc' }, include: { job: true } },
    },
  });
  if (!equipment) notFound();

  const now = new Date();
  const host = headers().get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const qrDataUrl = await generateEquipmentQrDataUrl(equipment.qrCode, `${protocol}://${host}`);

  const duePlans = excludeCoveredChildren(
    equipment.maintenancePlans.map(toDomainPlan),
    equipment.maintenancePlans.map(toDomainPlan),
  );

  // Every reservation here is already scoped to this one asset, so the sweep
  // naturally only ever compares this asset's bookings against each other.
  const reservationConflicts = findEquipmentConflicts(
    equipment.reservations.map((r) => ({ id: r.id, equipmentId: equipment.id, jobId: r.jobId, start: r.start, end: r.end })),
  );
  const conflictedReservationIds = new Set(reservationConflicts.flatMap((c) => [c.first.id, c.second.id]));

  return (
    <div className="space-y-6">
      <Link href="/equipment" className="text-sm text-zinc-500 hover:underline">
        ← Equipment
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{equipment.name}</h1>
          <p className="text-sm text-zinc-500">
            {equipment.category} · {equipment.qrCode} · {equipment.status.replace(/_/g, ' ').toLowerCase()}
          </p>
          <Link
            href={`/equipment/${equipment.id}/scan`}
            className="field-btn mt-4 inline-flex bg-zinc-900 text-white hover:bg-zinc-800"
          >
            Check in / check out
          </Link>
        </div>
        <div className="card flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code for ${equipment.qrCode}`} width={160} height={160} />
          <span className="text-xs text-zinc-500">{equipment.qrCode}</span>
        </div>
      </div>

      {/* Compliance — multi-parameter, tolerance-aware */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Compliance</h2>
        <ul className="divide-y divide-outdoor-border">
          {equipment.compliance.map((c) => {
            const currentValue = resolveCounterValue(c.counterType, equipment, now);
            const result = currentValue !== null
              ? getComplianceStatus(
                  { unit: c.counterType, intervalValue: c.intervalValue, toleranceValue: c.toleranceValue, hardLimit: c.hardLimit, dueValue: c.dueValue },
                  currentValue,
                  14,
                )
              : null;
            const status = !result ? 'warning' : result.status === 'overdue' ? 'blocked' : result.status === 'ok' ? 'ok' : 'warning';

            // Usage-based forecast for anything running on a meter rather
            // than the calendar. This is a lifetime average, not a recent
            // trend — the honest number available without a usage-logging
            // feature that records dated readings over time (see README).
            const forecastDays =
              c.counterType !== 'CALENDAR_DAYS' && currentValue !== null && result?.status !== 'overdue'
                ? forecastDaysUntilDue(
                    c.dueValue,
                    currentValue,
                    computeDailyUsageRate([
                      { date: equipment.inServiceDate, counterValue: 0 },
                      { date: now, counterValue: currentValue },
                    ]),
                  )
                : null;

            return (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium capitalize">{c.complianceType.toLowerCase()}</div>
                  <div className="text-xs text-zinc-500">
                    Due at {c.dueValue} {unitLabel(c.counterType)}
                    {c.hardLimit && ' · hard limit, no grace period'}
                    {!c.hardLimit && ` · ${c.toleranceValue} ${unitLabel(c.counterType)} tolerance`}
                    {currentValue !== null && ` · currently at ${Math.round(currentValue)} ${unitLabel(c.counterType)}`}
                  </div>
                  {forecastDays !== null && (
                    <div className="text-xs text-zinc-400">At lifetime-average pace, due in ~{Math.round(forecastDays)} days</div>
                  )}
                </div>
                <StatusBadge
                  status={status}
                  label={!result ? 'No reading' : result.status === 'overdue' ? 'Overdue' : result.status === 'in_tolerance' ? 'In grace period' : result.status === 'due_soon' ? 'Due soon' : 'Current'}
                />
              </li>
            );
          })}
          {equipment.compliance.length === 0 && <p className="py-2 text-sm text-zinc-500">No compliance items tracked for this asset.</p>}
        </ul>
      </div>

      {/* Reservations — forward bookings, distinct from current custody above */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Reservations</h2>
        <ul className="divide-y divide-outdoor-border">
          {equipment.reservations.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/jobs/${r.job.id}`} className="font-medium hover:underline">
                  {r.job.name}
                </Link>
                <div className="text-xs text-zinc-500">
                  {r.start.toLocaleDateString()} – {r.end.toLocaleDateString()}
                </div>
              </div>
              {conflictedReservationIds.has(r.id) && (
                <span className="text-xs font-medium text-red-700">Double-booked</span>
              )}
            </li>
          ))}
          {equipment.reservations.length === 0 && <p className="py-2 text-sm text-zinc-500">No forward bookings for this asset.</p>}
        </ul>
      </div>

      {/* Maintenance — nested hierarchy already collapsed to what's actually due */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Preventive maintenance</h2>
        <ul className="divide-y divide-outdoor-border">
          {duePlans.map((plan) => (
            <li key={plan.id} className="py-2">
              <div className="font-medium">{equipment.maintenancePlans.find((p) => p.id === plan.id)?.description}</div>
              <div className="text-xs text-zinc-500">
                Every {plan.schedule.intervalValue} {unitLabel(plan.schedule.unit)}, due at {plan.schedule.dueValue}
              </div>
            </li>
          ))}
          {duePlans.length === 0 && <p className="py-2 text-sm text-zinc-500">No maintenance plans configured.</p>}
        </ul>
      </div>

      {/* Open work orders */}
      {equipment.workOrders.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Work orders</h2>
          <ul className="divide-y divide-outdoor-border">
            {equipment.workOrders.map((wo) => (
              <li key={wo.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{wo.description}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={wo.status === 'COMPLETED' ? 'ok' : wo.status === 'IN_PROGRESS' ? 'warning' : 'blocked'} label={wo.status.replace(/_/g, ' ')} />
                    {wo.status !== 'COMPLETED' && <WorkOrderCompleteButton workOrderId={wo.id} />}
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {wo.source === 'DEFECT_REPORTED' ? 'Reported from a field scan' : 'Scheduled maintenance'} · opened{' '}
                  {wo.createdAt.toLocaleDateString()}
                  {wo.completedAt && ` · completed ${wo.completedAt.toLocaleDateString()}`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scan / custody history */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Scan history</h2>
        <ul className="divide-y divide-outdoor-border">
          {equipment.scanEvents.map((scan) => (
            <li key={scan.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{scan.action.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="text-xs text-zinc-500">{scan.timestamp.toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                <span>
                  {scan.scannedBy?.name ?? 'Unknown'} {scan.job ? `· ${scan.job.name}` : ''}
                </span>
                {scan.latitude !== null && scan.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    View location
                  </a>
                )}
              </div>
              {scan.conditionNote && <p className="mt-1 text-sm text-zinc-700">{scan.conditionNote}</p>}
              {scan.photos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {scan.photos.map((photo) => (
                    <div key={photo.id} className="h-16 w-16 overflow-hidden rounded-md border border-outdoor-border bg-outdoor-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.caption ?? 'Condition photo'} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
          {equipment.scanEvents.length === 0 && <p className="py-2 text-sm text-zinc-500">No scan history yet.</p>}
        </ul>
      </div>
    </div>
  );
}

function unitLabel(counterType: string): string {
  if (counterType === 'RUN_HOURS') return 'hours';
  if (counterType === 'CALENDAR_DAYS') return 'days';
  return 'cycles';
}
