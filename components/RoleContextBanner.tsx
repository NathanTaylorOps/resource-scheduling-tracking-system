import { ROLE_LABELS, type RolePermissions } from '@/lib/role';
import type { ViewingRole } from '@/lib/enums';

const PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  canViewFinancials: 'see dollar figures',
  canApprovePermits: 'approve permits & inspection outcomes',
  canEditCompliance: 'edit certifications & screenings',
  canManageSafety: 'log or close safety records',
  canOperateField: 'log field data',
};

const PERMISSION_ORDER: Array<keyof RolePermissions> = [
  'canOperateField',
  'canEditCompliance',
  'canManageSafety',
  'canApprovePermits',
  'canViewFinancials',
];

/**
 * A one-line, server-rendered explanation of what the current "viewing as"
 * role can and can't do on THIS page — the demo effect the role switcher
 * alone doesn't make obvious. Hiding a Pencil icon or a dollar column is
 * easy to miss entirely; naming the restriction out loud is what actually
 * shows a reviewer the RBAC concept working, not just a select box that
 * changes what's rendered for reasons they'd have to go hunting for.
 *
 * Deliberately not dismissible/stateful — this is read-only context, not a
 * notification, and every render already reflects whatever role is
 * currently selected.
 */
export function RoleContextBanner({ role, perms }: { role: ViewingRole; perms: RolePermissions }) {
  const allowed = PERMISSION_ORDER.filter((key) => perms[key]);
  const denied = PERMISSION_ORDER.filter((key) => !perms[key]);

  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
      <span className="font-medium text-zinc-700">Viewing as {ROLE_LABELS[role]}.</span>{' '}
      {denied.length === 0 ? (
        <>This role can see and do everything shown on this page.</>
      ) : (
        <>
          Can {allowed.length > 0 ? allowed.map((key) => PERMISSION_LABELS[key]).join(', ') : 'view only'} —
          {' '}can&apos;t {denied.map((key) => PERMISSION_LABELS[key]).join(', ')}. Switch roles above to compare.
        </>
      )}
    </div>
  );
}
