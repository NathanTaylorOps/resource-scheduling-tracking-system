import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ScreeningType, ScreeningResult } from '@/lib/enums';

interface CreateScreeningBody {
  screeningType: string;
  result: string;
  administeredDate: string;
  expiryDate?: string;
  notes?: string;
}

const VALID_TYPES = new Set<string>(Object.values(ScreeningType));
const VALID_RESULTS = new Set<string>(Object.values(ScreeningResult));

/**
 * Records a drug test or background check result for a worker. This is
 * deliberately its own record type rather than folded into WorkerCert —
 * a certification is a credential the worker holds and renews on a known
 * cycle; a screening is a point-in-time result with no renewal pattern to
 * model (see the domain/certifications.ts renewal-pattern comment), and
 * conflating the two would force a fake expiry cycle onto something that
 * doesn't have one for most screening types.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const worker = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!worker) {
    return NextResponse.json({ error: 'No worker matches that id.' }, { status: 404 });
  }

  let body: CreateScreeningBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.screeningType || !VALID_TYPES.has(body.screeningType)) {
    return NextResponse.json({ error: 'Select a screening type.' }, { status: 400 });
  }
  if (!body.result || !VALID_RESULTS.has(body.result)) {
    return NextResponse.json({ error: 'Select a result.' }, { status: 400 });
  }
  const administeredDate = new Date(body.administeredDate);
  if (Number.isNaN(administeredDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid administered date.' }, { status: 400 });
  }
  let expiryDate: Date | null = null;
  if (body.expiryDate) {
    expiryDate = new Date(body.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: 'Enter a valid expiry date.' }, { status: 400 });
    }
  }

  const screening = await prisma.workerScreening.create({
    data: {
      workerId: worker.id,
      screeningType: body.screeningType,
      result: body.result,
      administeredDate,
      expiryDate,
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({ id: screening.id }, { status: 201 });
}
