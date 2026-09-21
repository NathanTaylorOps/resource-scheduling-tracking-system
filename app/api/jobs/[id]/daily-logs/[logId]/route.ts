import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface UpdateDailyLogBody {
  weatherSummary?: string;
  crewCount: number;
  workPerformed: string;
  delaysNotes?: string;
  submittedBy?: string;
}

/**
 * Corrects an existing day's log — a same-day fix (a fat-fingered crew
 * count, a typo in what was performed), not a new record. This is the
 * only way to change a log once it's been submitted: DailyLog's
 * @@unique([jobId, logDate]) means the POST route hard-rejects a second
 * submission for a date already logged (409), so without this route a
 * mistake made on today's entry would be permanent. The log's date
 * itself isn't editable here — changing it could collide with another
 * day's log, and there's no real case for "which day was this" changing
 * after the fact.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; logId: string } }) {
  const log = await prisma.dailyLog.findUnique({ where: { id: params.logId } });
  if (!log || log.jobId !== params.id) {
    return NextResponse.json({ error: 'No matching daily log for this job.' }, { status: 404 });
  }

  let body: UpdateDailyLogBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!Number.isInteger(body.crewCount) || body.crewCount < 0) {
    return NextResponse.json({ error: 'Crew count must be a whole number of zero or more.' }, { status: 400 });
  }
  const workPerformed = body.workPerformed?.trim();
  if (!workPerformed) {
    return NextResponse.json({ error: 'Describe the work performed.' }, { status: 400 });
  }

  await prisma.dailyLog.update({
    where: { id: log.id },
    data: {
      weatherSummary: body.weatherSummary?.trim() || null,
      crewCount: body.crewCount,
      workPerformed,
      delaysNotes: body.delaysNotes?.trim() || null,
      submittedBy: body.submittedBy || null,
    },
  });

  return NextResponse.json({ ok: true });
}
