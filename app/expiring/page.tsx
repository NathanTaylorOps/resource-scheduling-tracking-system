import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { resolveCounterValue, resolveDueSoonWindow, DUE_SOON_WINDOW_DAYS, DAY_MS } from '@/lib/readiness-service';
import { isPastCalendarDate } from '@/lib/domain/dates';
import { StatusBadge } from '@/components/StatusBadge';
import type { ComponentStatus } from '@/lib/domain/readiness';

export const dynamic = 'force-dynamic';

/**
 * The cross-job "what needs attention this week" view every other screen
 * in this app deliberately doesn't provide — every other expiring/overdue
 * indicator here lives inside one job's, one worker's, or one asset's own
 * page (see app/jobs/[id]/page.tsx, app/workers/page.tsx,
 * app/equipment/page.tsx). That's the right place for it when you're
 * already looking at that one record, but it leaves no single screen a GM
 * or PM can open Monday morning to see every cert, COI, permit, and
 * compliance item expiring across every job at once — they'd have to open
 * every job, every worker, and every asset individually. This page is that
 * screen: one flat, sorted list, worst (already expired) first.
 */

type Row = {
  key: string;
  severity: ComponentStatus;
  category: string;
  subject: string;
  detail: string;
  daysUntil: number | null;
  href: string;
};

export default async function ExpiringPage() {
  const prisma = getDb();
  const now = new Date();

  const [workers, subcontractors, equipment, permits] = await Promise.all([
    prisma.worker.findMany({ include: { certifications: true } }),
    prisma.subcontractor.findMany({ include: { coiRecords: true } }),
    prisma.equipment.findMany({ include: { compliance: true, lifeCounters: true, maintenancePlans: true } }),
    prisma.permit.findMany({ include: { inspections: true, job: { select: { id: true, name: true } } } }),
  ]);

  const rows: Row[] = [];

  // --- Worker certifications ---
  for (const worker of workers) {
    for (const cert of worker.certifications) {
      const result = getCertificationStatus(cert.expiryDate, now, undefined, cert.renewalPattern, cert.renewalFiledDate);
      if (result.status === 'valid') continue;
      rows.push({
        key: `cert-${cert.id}`,
        severity: result.status === 'expired' ? 'blocked' : 'warning',
        category: 'Crew certification',
        subject: worker.name,
        detail: `${cert.certType} — ${describeCertStatus(result.status, result.daysUntilExpiry)}`,
        daysUntil: result.daysUntilExpiry,
        href: `/workers/${worker.id}`,
      });
    }
  }

  // --- Subcontractor entity-level compliance ---
  for (const sub of subcontractors) {
    const { credentials } = evaluateSubcontractorCompliance(
      { licenseExpiryDate: sub.licenseExpiryDate, coiRecords: sub.coiRecords },
      now,
    );
    for (const credential of credentials) {
      if (credential.status === 'valid') continue;
      rows.push({
        key: `sub-${sub.id}-${credential.label}`,
        severity: credential.status === 'expired' ? 'blocked' : 'warning',
        category: 'Subcontractor compliance',
        subject: sub.businessName,
        detail: `${credential.label} — ${describeCertStatus(credential.status, null)}`,
        daysUntil: null,
        href: `/subcontractors/${sub.id}`,
      });
    }
  }

  // --- Equipment compliance + maintenance ---
  for (const item of equipment) {
    const items = [
      ...item.compliance.map((c) => ({ label: c.complianceType, counterType: c.counterType, schedule: c })),
      ...item.maintenancePlans.map((p) => ({ label: 'Scheduled maintenance', counterType: p.counterType, schedule: p })),
    ];
    for (const { label, counterType, schedule } of items) {
      const currentValue = resolveCounterValue(counterType, item, now);
      if (currentValue === null) continue;
      const status = getComplianceStatus(
        {
          unit: counterType,
          intervalValue: schedule.intervalValue,
          toleranceValue: schedule.toleranceValue,
          hardLimit: schedule.hardLimit,
          dueValue: schedule.dueValue,
        },
        currentValue,
        resolveDueSoonWindow(counterType),
      );
      if (status.status === 'ok') continue;
      rows.push({
        key: `equip-${item.id}-${label}-${schedule.dueValue}`,
        severity: status.status === 'overdue' ? 'blocked' : 'warning',
        category: 'Equipment compliance',
        subject: item.name,
        detail: `${label} — ${status.status === 'overdue' ? 'overdue' : status.status === 'due_soon' ? 'due soon' : 'in tolerance'}`,
        daysUntil: null,
        href: `/equipment/${item.id}`,
      });
    }
  }

  // --- Permits & inspections ---
  for (const permit of permits) {
    const isExpired = permit.status === 'EXPIRED' || (permit.expiryDate !== null && isPastCalendarDate(permit.expiryDate, now));
    if (isExpired) {
      rows.push({
        key: `permit-${permit.id}`,
        severity: 'blocked',
        category: 'Permit',
        subject: permit.job.name,
        detail: `${titleCase(permit.permitType)} permit has expired`,
        daysUntil: permit.expiryDate ? Math.round((permit.expiryDate.getTime() - now.getTime()) / DAY_MS) : null,
        href: `/jobs/${permit.job.id}`,
      });
    }
    for (const inspection of permit.inspections) {
      if (inspection.status === 'FAILED') {
        rows.push({
          key: `inspection-${inspection.id}`,
          severity: 'blocked',
          category: 'Inspection',
          subject: permit.job.name,
          detail: `${titleCase(permit.permitType)} — ${titleCase(inspection.inspectionType)} inspection failed`,
          daysUntil: null,
          href: `/jobs/${permit.job.id}`,
        });
      } else if (
        inspection.status === 'SCHEDULED' &&
        inspection.scheduledDate !== null &&
        inspection.scheduledDate.getTime() >= now.getTime() &&
        inspection.scheduledDate.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * DAY_MS
      ) {
        const daysUntil = Math.round((inspection.scheduledDate.getTime() - now.getTime()) / DAY_MS);
        rows.push({
          key: `inspection-${inspection.id}`,
          severity: 'warning',
          category: 'Inspection',
          subject: permit.job.name,
          detail: `${titleCase(permit.permitType)} — ${titleCase(inspection.inspectionType)} inspection scheduled in ${daysUntil}d`,
          daysUntil,
          href: `/jobs/${permit.job.id}`,
        });
      }
    }
  }

  // Worst first, then soonest — 'blocked' (already expired/failed/overdue)
  // ahead of 'warning' (coming up soon), ties broken by whichever has the
  // least runway left. Items with no day count (subcontractor/equipment
  // items, which don't carry one here) sort after ones that do, within the
  // same severity — a concrete deadline is more actionable than "overdue,
  // exact date unknown."
  const SEVERITY_ORDER: Record<ComponentStatus, number> = { blocked: 0, warning: 1, unknown: 2, ok: 3 };
  rows.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (a.daysUntil === null && b.daysUntil === null) return 0;
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });

  const expiredCount = rows.filter((r) => r.severity === 'blocked').length;
  const dueSoonCount = rows.filter((r) => r.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expiring &amp; overdue</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every certification, subcontractor compliance item, equipment compliance item, permit, and inspection that
          needs attention — across every job, worker, and asset — worst first.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="text-3xl font-bold text-red-700">{expiredCount}</div>
          <div className="mt-1 text-sm text-zinc-500">Already expired, overdue, or failed</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-amber-700">{dueSoonCount}</div>
          <div className="mt-1 text-sm text-zinc-500">Due soon (within {DUE_SOON_WINDOW_DAYS} days)</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-outdoor-border shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outdoor-border bg-white">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-outdoor-surface">
                <td className="px-4 py-3 text-zinc-500">{row.category}</td>
                <td className="px-4 py-3">
                  <Link href={row.href} className="font-medium hover:underline">
                    {row.subject}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.detail}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.severity} label={row.severity === 'blocked' ? 'Expired/overdue' : 'Due soon'} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                  Nothing expiring or overdue anywhere in the system right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function describeCertStatus(status: string, daysUntilExpiry: number | null): string {
  switch (status) {
    case 'expired':
      return daysUntilExpiry !== null ? `expired ${Math.abs(daysUntilExpiry)}d ago` : 'expired';
    case 'expiring_soon':
      return daysUntilExpiry !== null ? `due in ${daysUntilExpiry}d` : 'due soon';
    case 'aging':
      return 'refresh recommended';
    case 'renewal_pending':
      return 'renewal filed, pending';
    default:
      return status;
  }
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
