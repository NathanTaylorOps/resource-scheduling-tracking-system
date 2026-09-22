import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';

interface CreatePayrollEntryBody {
  workerId: string;
  weekEnding: string;
  classification: string;
  hoursWorked: number;
  hourlyRate?: number;
  fringeRate?: number;
}

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
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreatePayrollEntryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.workerId) {
    return NextResponse.json({ error: 'Select a worker.' }, { status: 400 });
  }
  const worker = await prisma.worker.findUnique({ where: { id: body.workerId } });
  if (!worker) {
    return NextResponse.json({ error: 'No worker matches that id.' }, { status: 400 });
  }
  const weekEnding = new Date(body.weekEnding);
  if (Number.isNaN(weekEnding.getTime())) {
    return NextResponse.json({ error: 'Enter a valid week-ending date.' }, { status: 400 });
  }
  const classification = body.classification?.trim();
  if (!classification) {
    return NextResponse.json({ error: 'Enter a labor classification.' }, { status: 400 });
  }
  if (typeof body.hoursWorked !== 'number' || !Number.isFinite(body.hoursWorked) || body.hoursWorked <= 0) {
    return NextResponse.json({ error: 'Hours worked must be a positive number.' }, { status: 400 });
  }
  if (body.hourlyRate !== undefined && (typeof body.hourlyRate !== 'number' || !Number.isFinite(body.hourlyRate) || body.hourlyRate < 0)) {
    return NextResponse.json({ error: 'Hourly rate must be a non-negative number.' }, { status: 400 });
  }
  if (body.fringeRate !== undefined && (typeof body.fringeRate !== 'number' || !Number.isFinite(body.fringeRate) || body.fringeRate < 0)) {
    return NextResponse.json({ error: 'Fringe rate must be a non-negative number.' }, { status: 400 });
  }

  try {
    const entry = await prisma.certifiedPayrollEntry.create({
      data: {
        jobId: job.id,
        workerId: worker.id,
        weekEnding,
        classification,
        hoursWorked: body.hoursWorked,
        hourlyRate: body.hourlyRate ?? null,
        fringeRate: body.fringeRate ?? null,
      },
    });
    return NextResponse.json({ id: entry.id }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'This worker already has a payroll entry for that week on this job.' },
        { status: 409 },
      );
    }
    throw error;
  }
}
