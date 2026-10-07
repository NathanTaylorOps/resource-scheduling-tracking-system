import type { PrismaClient } from '@prisma/client';
import { getViewingActor } from './actor';

export const AuditAction = {
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',
  CERTIFICATION_CREATED: 'CERTIFICATION_CREATED',
  ASSET_CHECKED_OUT: 'ASSET_CHECKED_OUT',
  ASSET_CHECKED_IN: 'ASSET_CHECKED_IN',
  ASSET_LOCATION_UPDATED: 'ASSET_LOCATION_UPDATED',
  ASSET_DEFECT_REPORTED: 'ASSET_DEFECT_REPORTED',
  WORK_ORDER_COMPLETED: 'WORK_ORDER_COMPLETED',
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Appends one entry to AuditLogEntry — see that model's comment in
 * schema.prisma for what this is and, just as importantly, what it isn't
 * (not a field-by-field diff engine, not cryptographic attribution, since
 * this app has no real login for that attribution to be trustworthy
 * against). Called from the handful of routes that touch the fields
 * identified as operationally material: state transitions, scheduling commitments,
 * compliance records, custody changes, defects, and maintenance completion.
 * Routine descriptive edits and reads are intentionally excluded so the trail
 * remains useful rather than becoming a duplicate transaction log.
 *
 * Takes `tx` (a PrismaClient or an active `$transaction` callback's `tx`)
 * so a route that already writes inside a transaction can log the audit
 * entry as part of the same atomic write, rather than as a second,
 * separately-committable call.
 */
export async function recordAudit(
  tx: Pick<PrismaClient, 'auditLogEntry'>,
  params: { entityType: string; entityId: string; action: AuditActionName; summary: string },
): Promise<void> {
  const actor = await getViewingActor();
  await tx.auditLogEntry.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary,
      actorWorkerId: actor.workerId,
      actorLabel: actor.label,
    },
  });
}
