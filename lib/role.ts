/**
 * The "viewing as" role switcher — see components/RoleSwitcher.tsx.
 *
 * This is explicitly NOT access control. This app has no login (see the
 * README's Scope section — that's a deliberate boundary for this demo, not
 * an oversight), so there is no server that can actually verify who's
 * asking. What this IS: a UI-only demonstration of what a real RBAC model
 * for this domain would need to distinguish — which is itself the more
 * interesting question a reviewer asked for, not "add a login screen."
 * Every permission check here is enforced only in rendering (hide/disable
 * a control), never in an API route — an API route that actually checked
 * this cookie and called that a security boundary would be worse than not
 * checking it at all, since it would look like real access control to
 * someone who didn't read this comment. If this app ever got real auth,
 * this file is the permission matrix that auth would need to enforce
 * server-side; today it only enforces what's rendered.
 */

import { ViewingRole } from './enums';

export const ROLE_LABELS: Record<ViewingRole, string> = {
  EXECUTIVE: 'Executive (CEO / COO)',
  PROJECT_MANAGER: 'Project Manager',
  SUPERINTENDENT: 'Superintendent',
  SAFETY_DIRECTOR: 'Safety Director',
  SUBCONTRACTOR: 'Subcontractor',
  FIELD_WORKER: 'Field Worker',
};

export interface RolePermissions {
  /** Financial-adjacent figures — lien waiver dollar amounts, certified payroll rates. */
  canViewFinancials: boolean;
  /** Marking a permit ISSUED/FINALED/EXPIRED, recording an inspection outcome. */
  canApprovePermits: boolean;
  /** Editing a subcontractor's own COI/license, or a worker's own certification. */
  canEditCompliance: boolean;
  /** Closing a safety incident, editing a JHA. */
  canManageSafety: boolean;
  /** Everything else — logging a daily entry, scanning equipment, viewing. */
  canOperateField: boolean;
}

// The permission matrix itself — a domain-specific answer to "what would a
// superintendent be able to do that a subcontractor couldn't," not a
// generic admin/editor/viewer tier system. A subcontractor role is
// deliberately the most restricted: they should see their OWN firm's
// standing (this app has no per-firm data scoping to enforce that even at
// the UI level yet — see the README) but shouldn't be approving permits or
// seeing another firm's financial terms.
export const ROLE_PERMISSIONS: Record<ViewingRole, RolePermissions> = {
  EXECUTIVE: { canViewFinancials: true, canApprovePermits: true, canEditCompliance: true, canManageSafety: true, canOperateField: true },
  PROJECT_MANAGER: { canViewFinancials: true, canApprovePermits: true, canEditCompliance: true, canManageSafety: true, canOperateField: true },
  SUPERINTENDENT: { canViewFinancials: false, canApprovePermits: false, canEditCompliance: false, canManageSafety: true, canOperateField: true },
  SAFETY_DIRECTOR: { canViewFinancials: false, canApprovePermits: false, canEditCompliance: false, canManageSafety: true, canOperateField: true },
  SUBCONTRACTOR: { canViewFinancials: false, canApprovePermits: false, canEditCompliance: true, canManageSafety: false, canOperateField: false },
  FIELD_WORKER: { canViewFinancials: false, canApprovePermits: false, canEditCompliance: false, canManageSafety: false, canOperateField: true },
};

export function permissionsFor(role: ViewingRole): RolePermissions {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.FIELD_WORKER;
}
