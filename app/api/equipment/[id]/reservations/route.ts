import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, ValidationError, NotFoundError, ConflictError } from '@/lib/validate';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Books an asset to a job over a date range. A reservation is a plan, not
 * custody — it doesn't touch Equipment.currentJobId, which only a scan
 * event changes (see lib/domain/custody.ts). Conflict detection is a read-
 * time check (findEquipmentConflicts, lib/domain/equipment.ts) against every
 * reservation on this asset, not a write-time block — the README's own
 * position is that a double-booking should surface as a visible conflict
 * the moment it happens, not be silently prevented, since a real
 * superintendent sometimes needs to book over a conflict on purpose and
 * sort it out with whoever else has the asset.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const equipment = await prisma.equipment.findFirst({ where: { OR: [{ id: params.id }, { qrCode: params.id }] } });
    if (!equipment) {
      throw new NotFoundError('No equipment matches that id.');
    }

    const body = await parseJsonBody(request);
    const jobId = requiredString(body, 'jobId', 'Select a job.');
    const start = requiredDate(body, 'start', 'Enter valid start and end dates.');
    const end = requiredDate(body, 'end', 'Enter valid start and end dates.');
    if (end.getTime() <= start.getTime()) {
      throw new ValidationError('End date must be after the start date.');
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new ValidationError('No job matches that id.');
    }

    // No findFirst pre-check — @@unique([equipmentId, jobId, start, end]) on
    // EquipmentReservation only rejects an EXACT duplicate, never an
    // overlapping-but-different booking, which stays intentionally allowed
    // (see this function's own doc comment).
    try {
      const reservation = await prisma.equipmentReservation.create({
        data: { equipmentId: equipment.id, jobId: job.id, start, end },
      });
      return NextResponse.json({ id: reservation.id }, { status: 201 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('This exact reservation (same job, same dates) already exists for this asset.');
      }
      throw error;
    }
  } catch (err) {
    return apiError(err);
  }
}
