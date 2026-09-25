import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PermitType, PermitStatus } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, requiredEnum, NotFoundError } from '@/lib/validate';

/**
 * Files a new permit against a job, status APPLIED — the same starting
 * point every seeded permit uses. Its inspection sequence isn't generated
 * here: there's no canonical footing-through-final sequence modeled
 * anywhere in this codebase to generate it from (see AddInspectionForm),
 * so inspections get added one at a time as they're actually scheduled,
 * rather than this route guessing at a sequence that might not match how a
 * real jurisdiction orders them.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const permitType = requiredEnum(body, 'permitType', PermitType, 'Select a permit type.');
    const issuingAuthority = requiredString(body, 'issuingAuthority', 'Enter the issuing authority.');
    const appliedDate = requiredDate(body, 'appliedDate', 'Enter a valid applied date.');

    const permit = await prisma.permit.create({
      data: {
        jobId: job.id,
        permitType,
        issuingAuthority,
        permitNumber: optionalString(body, 'permitNumber'),
        appliedDate,
        status: PermitStatus.APPLIED,
      },
    });

    return NextResponse.json({ id: permit.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
