import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, requiredNumber, optionalNumber, NotFoundError, ValidationError, ConflictError } from '@/lib/validate';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Adds one worker's certified-payroll line for a week on a job that
 * requires it (Job.certifiedPayrollRequired — see that field's comment).
 * This is explicitly NOT a payroll system: no tax withholding, no
 * multi-worker batch import, no WH-347 export. It's the minimum shape
 * (classification, hours, rate, fringe) a certified-payroll report
 * actually needs per worker per week, kept as one entry per
 * (job, worker, weekEnding) so re-submitting a corrected week overwrites
 * rather than duplicates.
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
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      throw new ValidationError('No worker matches that id.');
    }
    const weekEnding = requiredDate(body, 'weekEnding', 'Enter a valid week-ending date.');
    const classification = requiredString(body, 'classification', 'Enter a labor classification.');
    const hoursWorked = requiredNumber(body, 'hoursWorked', { min: Number.MIN_VALUE }, 'Hours worked must be a positive number.');
    const hourlyRate = optionalNumber(body, 'hourlyRate', { min: 0 }, 'Hourly rate must be a non-negative number.');
    const fringeRate = optionalNumber(body, 'fringeRate', { min: 0 }, 'Fringe rate must be a non-negative number.');

    try {
      const entry = await prisma.certifiedPayrollEntry.create({
        data: {
          jobId: job.id,
          workerId: worker.id,
          weekEnding,
          classification,
          hoursWorked,
          hourlyRate,
          fringeRate,
        },
      });
      return NextResponse.json({ id: entry.id }, { status: 201 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('This worker already has a payroll entry for that week on this job.');
      }
      throw error;
    }
  } catch (err) {
    return apiError(err);
  }
}
