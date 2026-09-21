import { CircleCheck, TriangleAlert, CircleX, CircleHelp } from 'lucide-react';
import type { ComponentStatus } from '@/lib/domain/readiness';
import type { CertificationStatusResult } from '@/lib/domain/certifications';

const LABELS: Record<ComponentStatus, string> = {
  ok: 'OK',
  warning: 'Warning',
  blocked: 'Blocked',
  unknown: 'Not yet checked',
};

/**
 * The label a page shows for an *overall* readiness verdict specifically —
 * distinct wording from the per-component LABELS above ("Ready" reads
 * better than "OK" for a whole job). Exported so every screen that shows
 * an overall badge (dashboard, field picker, map) pulls from one map
 * instead of each hand-rolling its own ok/warning/else ternary — a ternary
 * with only two named branches silently sends every other status, present
 * or future, down the same fallback branch, which is exactly how the
 * previous round's weather default-to-"ok" bug happened in the first
 * place.
 */
export const OVERALL_READINESS_LABEL: Record<ComponentStatus, string> = {
  ok: 'Ready',
  warning: 'Attention',
  blocked: 'Blocked',
  unknown: 'Needs review',
};

const CLASSES: Record<ComponentStatus, string> = {
  ok: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  blocked: 'bg-red-50 text-red-800 border-red-200',
  unknown: 'bg-zinc-100 text-zinc-600 border-zinc-300',
};

// A shape per status, not just a color per status — so the difference
// between "ready" and "blocked" still reads for a colorblind viewer, or on
// a washed-out screen in direct sun where the outdoor-mode palette above
// is already doing what it can.
const ICONS: Record<ComponentStatus, typeof CircleCheck> = {
  ok: CircleCheck,
  warning: TriangleAlert,
  blocked: CircleX,
  unknown: CircleHelp,
};

/**
 * The single status vocabulary used everywhere a readiness, compliance, or
 * maintenance state is shown — never a bespoke color or icon chosen per
 * screen.
 */
export function StatusBadge({ status, label }: { status: ComponentStatus; label?: string }) {
  const Icon = ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${CLASSES[status]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
