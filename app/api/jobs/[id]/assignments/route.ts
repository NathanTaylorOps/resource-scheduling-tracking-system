import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { canAssignWorker, parseCertTypesList } from '@/lib/domain/certifications';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, ValidationError, NotFoundError, ConflictError } from '@/lib/validate';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Assigns a worker to a job for a role and date range.
 *
 * Certification eligibility is a hard stop, not a warning — the README's
 * own claim ("a hard stop on assigning someone to a role that requires a
 * certification they don't currently hold") only holds if this route
 * actually enforces it. The required cert types come from this job's
 * JobRoleRequirement for the same roleOnJob, if one exists and has
 * requiredCertTypes set (see that field's comment in schema.prisma); a role
 * with no matching requirement, or a requirement with no required certs
 * listed, has nothing to check and always passes.
 *
 * A double-booking, by contrast, is NOT blocked here — the same
 * intentional choice the equipment-reservation route already makes (see
 * its own comment): a scheduling conflict should surface as a visible flag
 * (the job detail page's existing findOverlaps check does this the moment
 * the page next renders), not be silently prevented, since a real PM
 * sometimes needs to book over a conflict on purpose and sort it out.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const workerId = requiredString(body, 'workerId', 'Select a worker.');
    const roleOnJob = requiredString(body, 'roleOnJob', 'Enter the role this assignment is for.');
    const start = requiredDate(body, 'start', 'Enter valid start and end dates.');
    const end = requiredDate(body, 'end', 'Enter valid start and end dates.');
    if (end.getTime() <= start.getTime()) {
      throw new ValidationError('End date must be after the start date.');
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { certifications: true },
    });
    if (!worker) {
      throw new ValidationError('No worker matches that selection.');
    }

    // findFirst is safe here because @@unique([jobId, roleOrTrade]) on
    // JobRoleRequirement (schema.prisma) guarantees at most one row can match —
    // this can never silently pick between two requirements for the same role.
    const requirement = await prisma.jobRoleRequirement.findFirst({
      where: { jobId: job.id, roleOrTrade: roleOnJob },
    });
    const requiredCertTypes = parseCertTypesList(requirement?.requiredCertTypes);

    if (requiredCertTypes.length > 0) {
      const eligibility = canAssignWorker(requiredCertTypes, worker.certifications, new Date());
      if (!eligibility.eligible) {
        throw new ConflictError(
          `${worker.name} is missing or has an expired required certification: ${eligibility.missingOrExpired.join(', ')}.`,
        );
      }
    }

    // No findFirst pre-check — @@unique([workerId, jobId, roleOnJob, start,
    // end]) on Assignment only rejects an EXACT duplicate (a double-click, a
    // retried submit), never an overlapping-but-different assignment, which
    // stays intentionally allowed (see this function's own doc comment).
    try {
      const assignment = await prisma.assignment.create({
        data: { workerId: worker.id, jobId: job.id, roleOnJob, start, end },
      });
      return NextResponse.json({ id: assignment.id }, { status: 201 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(`${worker.name} is already assigned to this exact role and date range on this job.`);
      }
      throw error;
    }
  } catch (err) {
    return apiError(err);
  }
}
