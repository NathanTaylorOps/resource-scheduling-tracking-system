import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { NotFoundError } from '@/lib/validate';

/** Cancels a forward booking. A hard delete — a cancelled reservation isn't a record anyone needs to keep. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; resId: string } }) {
  try {
    const prisma = getDb();
    const reservation = await prisma.equipmentReservation.findUnique({ where: { id: params.resId } });
    if (!reservation || reservation.equipmentId !== params.id) {
      throw new NotFoundError('No matching reservation on this asset.');
    }

    await prisma.equipmentReservation.delete({ where: { id: params.resId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
