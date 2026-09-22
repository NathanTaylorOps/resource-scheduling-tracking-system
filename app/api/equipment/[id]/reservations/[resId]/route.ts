import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** Cancels a forward booking. A hard delete — a cancelled reservation isn't a record anyone needs to keep. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; resId: string } }) {
  const prisma = getDb();
  const reservation = await prisma.equipmentReservation.findUnique({ where: { id: params.resId } });
  if (!reservation || reservation.equipmentId !== params.id) {
    return NextResponse.json({ error: 'No matching reservation on this asset.' }, { status: 404 });
  }

  await prisma.equipmentReservation.delete({ where: { id: params.resId } });
  return NextResponse.json({ ok: true });
}
