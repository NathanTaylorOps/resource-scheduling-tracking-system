import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { InspectionType, InspectionStatus } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredEnum, requiredNumber, NotFoundError, ConflictError } from '@/lib/validate';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Adds one inspection to a permit's sequence, starting NOT_SCHEDULED. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const permit = await prisma.permit.findUnique({ where: { id: params.id } });
    if (!permit) {
      throw new NotFoundError('No permit matches that id.');
    }

    const body = await parseJsonBody(request);
    const inspectionType = requiredEnum(body, 'inspectionType', InspectionType, 'Select an inspection type.');
    const sequence = requiredNumber(body, 'sequence', { integer: true, min: 1 }, 'Sequence must be a whole number of at least 1.');

    // No findFirst pre-check here — the @@unique([permitId, sequence])
    // constraint on Inspection is the actual guard, and the common case (a
    // form re-submitted with a sequence number already in use) is cheap
    // enough to just attempt and catch.
    try {
      const inspection = await prisma.inspection.create({
        data: {
          permitId: permit.id,
          inspectionType,
          sequence,
          status: InspectionStatus.NOT_SCHEDULED,
        },
      });
      return NextResponse.json({ id: inspection.id }, { status: 201 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(`This permit already has an inspection at sequence ${sequence}. Use a different sequence number.`);
      }
      throw error;
    }
  } catch (err) {
    return apiError(err);
  }
}
