import type { ComponentStatus } from '@/lib/domain/readiness';

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
