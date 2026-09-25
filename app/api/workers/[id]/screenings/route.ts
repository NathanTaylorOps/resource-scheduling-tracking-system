import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ScreeningType, ScreeningResult } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredDate, optionalDate, optionalString, requiredEnum, NotFoundError } from '@/lib/validate';

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
  try {
    const prisma = getDb();
    const worker = await prisma.worker.findUnique({ where: { id: params.id } });
    if (!worker) {
      throw new NotFoundError('No worker matches that id.');
    }

    const body = await parseJsonBody(request);
    const screeningType = requiredEnum(body, 'screeningType', ScreeningType, 'Select a screening type.');
    const result = requiredEnum(body, 'result', ScreeningResult, 'Select a result.');
    const administeredDate = requiredDate(body, 'administeredDate', 'Enter a valid administered date.');
    const expiryDate = optionalDate(body, 'expiryDate', 'Enter a valid expiry date.');

    const screening = await prisma.workerScreening.create({
      data: {
        workerId: worker.id,
        screeningType,
        result,
        administeredDate,
        expiryDate,
        notes: optionalString(body, 'notes'),
      },
    });

    return NextResponse.json({ id: screening.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
