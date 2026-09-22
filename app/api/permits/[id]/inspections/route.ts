import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { InspectionType, InspectionStatus } from '@/lib/enums';

interface CreateInspectionBody {
  inspectionType: string;
  sequence: number;
}

const VALID_INSPECTION_TYPES = new Set<string>(Object.values(InspectionType));

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Adds one inspection to a permit's sequence, starting NOT_SCHEDULED. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const permit = await prisma.permit.findUnique({ where: { id: params.id } });
  if (!permit) {
    return NextResponse.json({ error: 'No permit matches that id.' }, { status: 404 });
  }

  let body: CreateInspectionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.inspectionType || !VALID_INSPECTION_TYPES.has(body.inspectionType)) {
    return NextResponse.json({ error: 'Select an inspection type.' }, { status: 400 });
  }
  if (!Number.isInteger(body.sequence) || body.sequence < 1) {
    return NextResponse.json({ error: 'Sequence must be a whole number of at least 1.' }, { status: 400 });
  }

  // No findFirst pre-check here — the @@unique([permitId, sequence])
  // constraint on Inspection is the actual guard, and the common case (a
  // form re-submitted with a sequence number already in use) is cheap
  // enough to just attempt and catch, the same one-round-trip shape the
  // scan route uses for its own conflict cases.
  try {
    const inspection = await prisma.inspection.create({
      data: {
        permitId: permit.id,
        inspectionType: body.inspectionType,
        sequence: body.sequence,
        status: InspectionStatus.NOT_SCHEDULED,
      },
    });
    return NextResponse.json({ id: inspection.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: `This permit already has an inspection at sequence ${body.sequence}. Use a different sequence number.` },
        { status: 409 },
      );
    }
    throw error;
  }
}
