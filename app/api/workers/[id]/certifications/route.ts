import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { RenewalPattern } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, optionalDate, optionalEnum, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Adds a certification record to a worker's personal file. Outside Prisma
 * Studio, this is the only way a worker created after seeding can ever hold
 * a certification at all — canAssignWorker's hard stop (see
 * app/api/jobs/[id]/assignments) reads the certifications this route writes.
 *
 * renewalFiledDate only means anything for a GRACE_PERIOD certification
 * (see WorkerCertification.renewalPattern's own comment in schema.prisma —
 * it's the one pattern where a renewal filed before expiry keeps the old
 * certification valid while it's pending) and is ignored for any other
 * pattern rather than rejected, so a stray value left over from switching
 * the renewal-pattern select doesn't block an otherwise-valid save.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const worker = await prisma.worker.findUnique({ where: { id: params.id } });
    if (!worker) {
      throw new NotFoundError('No worker matches that id.');
    }

    const body = await parseJsonBody(request);
    const certType = requiredString(body, 'certType', 'Enter the certification type.');
    const issuingBody = requiredString(body, 'issuingBody', 'Enter the issuing body.');
    const issueDate = requiredDate(body, 'issueDate', 'Enter valid issue and expiry dates.');
    const expiryDate = requiredDate(body, 'expiryDate', 'Enter valid issue and expiry dates.');
    if (expiryDate.getTime() <= issueDate.getTime()) {
      throw new ValidationError('Expiry date must be after the issue date.');
    }
    const renewalPattern = optionalEnum(body, 'renewalPattern', RenewalPattern, RenewalPattern.HARD_EXPIRY, 'Select a valid renewal pattern.');
    const renewalFiledDate =
      renewalPattern === RenewalPattern.GRACE_PERIOD ? optionalDate(body, 'renewalFiledDate', 'Enter a valid renewal-filed date.') : null;

    const certification = await prisma.workerCertification.create({
      data: {
        workerId: worker.id,
        certType,
        issuingBody,
        issueDate,
        expiryDate,
        renewalPattern,
        renewalFiledDate,
      },
    });

    return NextResponse.json({ id: certification.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
