import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LienWaiverStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, optionalString, optionalDate, requiredDate, requiredEnum, NotFoundError, ValidationError, ConflictError } from '@/lib/validate';

/**
 * Advances a lien waiver's status — PENDING to RECEIVED once the
 * subcontractor's signed waiver is actually in hand, or to DISPUTED if
 * they contest an amount. Same audit rationale as permit status: this is
 * exactly the fact a payment dispute turns on months later.
 *
 * A PATCH touches only the fields the client sent.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const prisma = await getDb();
    const waiver = await prisma.lienWaiver.findUnique({ where: { id: params.id } });
    if (!waiver) {
      throw new NotFoundError('No lien waiver matches that id.');
    }

    const body = await parseJsonBody(request);
    const expectedUpdatedAt = requiredDate(body, 'expectedUpdatedAt', 'Refresh this record before editing it again.');
    const data: { status?: string; receivedDate?: Date | null; notes?: string | null } = {};

    if (has(body, 'status')) data.status = requiredEnum(body, 'status', LienWaiverStatus, 'Select a valid status.');
    if (has(body, 'receivedDate')) data.receivedDate = optionalDate(body, 'receivedDate', 'Enter a valid received date.');
    if (has(body, 'notes')) data.notes = optionalString(body, 'notes');

    const effectiveStatus = data.status ?? waiver.status;
    const effectiveReceivedDate = has(body, 'receivedDate') ? data.receivedDate : waiver.receivedDate;
    if (effectiveStatus === LienWaiverStatus.RECEIVED && !effectiveReceivedDate) {
      throw new ValidationError('Set a received date to mark a waiver received.');
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id: waiver.id });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.lienWaiver.findUnique({ where: { id: waiver.id } });
      if (!current) throw new NotFoundError('No lien waiver matches that id.');
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ConflictError('This lien waiver changed after you opened it. Refresh and review the latest values before saving.');
      const result = await tx.lienWaiver.update({ where: { id: waiver.id, updatedAt: expectedUpdatedAt }, data });
      if (data.status !== undefined && current.status !== data.status) {
        await recordAudit(tx, {
          entityType: 'LienWaiver',
          entityId: waiver.id,
          action: 'STATUS_CHANGE',
          summary: `Status changed from ${current.status} to ${data.status}.`,
        });
      }
      return result;
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return apiError(err);
  }
}
