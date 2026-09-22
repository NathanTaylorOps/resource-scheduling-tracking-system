import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';

interface CreateReservationBody {
  jobId: string;
  start: string;
  end: string;
}

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
  const prisma = getDb();
  const equipment = await prisma.equipment.findFirst({ where: { OR: [{ id: params.id }, { qrCode: params.id }] } });
  if (!equipment) {
    return NextResponse.json({ error: 'No equipment matches that id.' }, { status: 404 });
  }

  let body: CreateReservationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: 'Select a job.' }, { status: 400 });
  }
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Enter valid start and end dates.' }, { status: 400 });
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: 'End date must be after the start date.' }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: body.jobId } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'This exact reservation (same job, same dates) already exists for this asset.' },
        { status: 409 },
      );
    }
    throw error;
  }
}
