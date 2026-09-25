import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, requiredNumber, NotFoundError, ValidationError, ConflictError } from '@/lib/validate';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Records one day's field log — the standard GC documentation the README
 * points to as mattering in a dispute or warranty claim, informational
 * only, same as the read side (doesn't feed readiness). One per job per
 * day (see the @@unique on DailyLog in schema.prisma), so a second
 * submission for a date already logged is a real conflict, not something
 * to silently overwrite. logDate arrives as a form date and is stored as
 * midnight of that day in the app timezone, which is what the job and
 * field pages look today's entry up by.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const logDate = requiredDate(body, 'logDate', 'Enter a valid date.');
    const crewCount = requiredNumber(body, 'crewCount', { integer: true, min: 0 }, 'Crew count must be a whole number of zero or more.');
    const workPerformed = requiredString(body, 'workPerformed', 'Describe the work performed.');

    // submittedBy is optional — a log entered without attributing it to a
    // specific crew member is still a valid log (see the "Unattributed" read
    // side on the job detail page) — but a value that IS given has to name a
    // real worker, rather than surfacing as a raw foreign-key failure.
    let submittedBy: string | null = null;
    const submitterId = optionalString(body, 'submittedBy');
    if (submitterId) {
      const submitter = await prisma.worker.findUnique({ where: { id: submitterId } });
      if (!submitter) {
        throw new ValidationError('No worker matches the selected submitter.');
      }
      submittedBy = submitter.id;
    }

    const duplicateMessage = 'A daily log already exists for this job on that date.';
    const existing = await prisma.dailyLog.findUnique({ where: { jobId_logDate: { jobId: job.id, logDate } } });
    if (existing) {
      throw new ConflictError(duplicateMessage);
    }

    try {
      const log = await prisma.dailyLog.create({
        data: {
          jobId: job.id,
          logDate,
          weatherSummary: optionalString(body, 'weatherSummary'),
          crewCount,
          workPerformed,
          delaysNotes: optionalString(body, 'delaysNotes'),
          submittedBy,
        },
      });
      return NextResponse.json({ id: log.id }, { status: 201 });
    } catch (error) {
      // The findUnique check above can't close the race between two
      // concurrent submissions for the same job/date on its own; the
      // @@unique([jobId, logDate]) constraint is the real guard, and this
      // turns its violation into the same 409.
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(duplicateMessage);
      }
      throw error;
    }
  } catch (err) {
    return apiError(err);
  }
}
