import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { InspectionType, InspectionStatus } from '@/lib/enums';

interface CreateInspectionBody {
  inspectionType: string;
  sequence: number;
}

const VALID_INSPECTION_TYPES = new Set<string>(Object.values(InspectionType));

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

  const inspection = await prisma.inspection.create({
    data: {
      permitId: permit.id,
      inspectionType: body.inspectionType,
      sequence: body.sequence,
      status: InspectionStatus.NOT_SCHEDULED,
    },
  });

  return NextResponse.json({ id: inspection.id }, { status: 201 });
}
