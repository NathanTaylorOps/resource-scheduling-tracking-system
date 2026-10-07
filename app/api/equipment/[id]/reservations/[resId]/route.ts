import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { AuditAction, recordAudit } from '@/lib/audit';
import { NotFoundError } from '@/lib/validate';

/** Cancels a forward booking. A hard delete — a cancelled reservation isn't a record anyone needs to keep. */
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string; resId: string }> }
) {
  const params = await props.params;
  try {
    const prisma = await getDb();
    const reservation = await prisma.equipmentReservation.findUnique({ where: { id: params.resId } });
    if (!reservation || reservation.equipmentId !== params.id) {
      throw new NotFoundError('No matching reservation on this asset.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.equipmentReservation.delete({ where: { id: params.resId } });
      await recordAudit(tx, {
        entityType: 'EquipmentReservation',
        entityId: reservation.id,
        action: AuditAction.RESERVATION_CANCELLED,
        summary: `Reservation for equipment ${reservation.equipmentId} on job ${reservation.jobId} cancelled.`,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
