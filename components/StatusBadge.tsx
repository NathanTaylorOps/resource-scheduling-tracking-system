import type { ComponentStatus } from '@/lib/domain/readiness';
import type { CertificationStatusResult } from '@/lib/domain/certifications';

const LABELS: Record<ComponentStatus, string> = {
  ok: 'OK',
  warning: 'Warning',
  blocked: 'Blocked',
};

const CLASSES: Record<ComponentStatus, string> = {
  ok: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  blocked: 'bg-red-50 text-red-800 border-red-200',
};

/**
 * The single status-color vocabulary used everywhere a readiness,
 * compliance, or maintenance state is shown — never a bespoke color chosen
 * per screen.
 */
export function StatusBadge({ status, label }: { status: ComponentStatus; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${CLASSES[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'ok' ? 'bg-status-ok' : status === 'warning' ? 'bg-status-warning' : 'bg-status-blocked'
        }`}
      />
      {label ?? LABELS[status]}
    </span>
  );
}

/**
 * Maps a certification/COI/license status result down to the three-value
 * severity StatusBadge renders, plus a human label — one place for this so
 * a worker cert, a subcontractor's COI, and a subcontractor's license never
 * end up colored differently for the same underlying status on different
 * screens. 'aging' and 'renewal_pending' both read as a heads-up (warning),
 * never a hard block — the credential is still legally held in both cases,
 * see lib/domain/certifications.ts.
 */
export function certificationBadge(result: CertificationStatusResult): { status: ComponentStatus; label: string } {
  switch (result.status) {
    case 'expired':
      return { status: 'blocked', label: `Expired ${Math.abs(result.daysUntilExpiry)}d ago` };
    case 'expiring_soon':
      return { status: 'warning', label: `Due in ${result.daysUntilExpiry}d` };
    case 'aging':
      return { status: 'warning', label: 'Refresh recommended' };
    case 'renewal_pending':
      return { status: 'warning', label: 'Renewal filed, pending' };
    case 'valid':
    default:
      return { status: 'ok', label: 'Current' };
  }
}
