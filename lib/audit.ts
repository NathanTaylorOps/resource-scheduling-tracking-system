import type { PrismaClient } from '@prisma/client';
import { getViewingActor } from './actor';

/**
 * Appends one entry to AuditLogEntry — see that model's comment in
 * schema.prisma for what this is and, just as importantly, what it isn't
 * (not a field-by-field diff engine, not cryptographic attribution, since
 * this app has no real login for that attribution to be trustworthy
 * against). Called from the handful of routes that touch the fields
 * identified as actually disputed later — permit status, inspection
 * outcomes, lien waiver status, safety incident status — not wired into
 * every mutation in the app; a real production version would extend this
 * pattern to every write, but instrumenting all of them here would bury
 * the concept in repetition rather than demonstrate it.
 *
 * Takes `tx` (a PrismaClient or an active `$transaction` callback's `tx`)
 * so a route that already writes inside a transaction can log the audit
 * entry as part of the same atomic write, rather than as a second,
 * separately-committable call.
 */
export async function recordAudit(
  tx: Pick<PrismaClient, 'auditLogEntry'>,
  params: { entityType: string; entityId: string; action: string; summary: string },
): Promise<void> {
  const actor = getViewingActor();
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
