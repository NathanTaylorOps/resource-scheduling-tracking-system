import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface CreateDailyLogBody {
  logDate: string;
  weatherSummary?: string;
  crewCount: number;
  workPerformed: string;
  delaysNotes?: string;
  submittedBy?: string;
}

/**
 * Records one day's field log — the standard GC documentation the README
 * points to as mattering in a dispute or warranty claim, informational
 * only, same as the read side (doesn't feed readiness). One per job per
 * day (see the @@unique on DailyLog in schema.prisma), so a second
 * submission for a date already logged is a real conflict, not something
 * to silently overwrite.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateDailyLogBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const logDate = new Date(body.logDate);
  if (Number.isNaN(logDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid date.' }, { status: 400 });
  }
  if (!Number.isInteger(body.crewCount) || body.crewCount < 0) {
    return NextResponse.json({ error: 'Crew count must be a whole number of zero or more.' }, { status: 400 });
  }
  const workPerformed = body.workPerformed?.trim();
  if (!workPerformed) {
    return NextResponse.json({ error: 'Describe the work performed.' }, { status: 400 });
  }

  // submittedBy is optional — a log entered without attributing it to a
  // specific crew member is still a valid log (see the "Unattributed" read
  // side on the job detail page) — but a value that IS given has to name a
  // real worker, the same up-front check every other worker reference in
  // this app gets, rather than surfacing as a raw foreign-key failure.
  let submittedBy: string | null = null;
  if (body.submittedBy) {
    const submitter = await prisma.worker.findUnique({ where: { id: body.submittedBy } });
    if (!submitter) {
      return NextResponse.json({ error: 'No worker matches the selected submitter.' }, { status: 400 });
    }
    submittedBy = submitter.id;
  }

  const existing = await prisma.dailyLog.findUnique({ where: { jobId_logDate: { jobId: job.id, logDate } } });
  if (existing) {
    return NextResponse.json({ error: 'A daily log already exists for this job on that date.' }, { status: 409 });
  }

  const log = await prisma.dailyLog.create({
    data: {
      jobId: job.id,
      logDate,
      weatherSummary: body.weatherSummary?.trim() || null,
      crewCount: body.crewCount,
      workPerformed,
      delaysNotes: body.delaysNotes?.trim() || null,
      submittedBy,
    },
  });

  return NextResponse.json({ id: log.id }, { status: 201 });
}
