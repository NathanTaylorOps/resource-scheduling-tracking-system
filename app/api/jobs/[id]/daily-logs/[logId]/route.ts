import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, requiredString, optionalString, requiredNumber, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Corrects an existing day's log — a same-day fix (a fat-fingered crew
 * count, a typo in what was performed), not a new record. This is the
 * only way to change a log once it's been submitted: DailyLog's
 * @@unique([jobId, logDate]) means the POST route hard-rejects a second
 * submission for a date already logged (409). The log's date itself isn't
 * editable here — changing it could collide with another day's log, and
 * there's no real case for "which day was this" changing after the fact.
 *
 * Only the fields the client sent are touched; a key sent as null or blank
 * clears that field, a key left out leaves it as it was.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; logId: string } }) {
  try {
    const prisma = getDb();
    const log = await prisma.dailyLog.findUnique({ where: { id: params.logId } });
    if (!log || log.jobId !== params.id) {
      throw new NotFoundError('No matching daily log for this job.');
    }

    const body = await parseJsonBody(request);
    const data: {
      weatherSummary?: string | null;
      crewCount?: number;
      workPerformed?: string;
      delaysNotes?: string | null;
      submittedBy?: string | null;
    } = {};

    if (has(body, 'weatherSummary')) data.weatherSummary = optionalString(body, 'weatherSummary');
    if (has(body, 'crewCount')) {
      data.crewCount = requiredNumber(body, 'crewCount', { integer: true, min: 0 }, 'Crew count must be a whole number of zero or more.');
    }
    if (has(body, 'workPerformed')) data.workPerformed = requiredString(body, 'workPerformed', 'Describe the work performed.');
    if (has(body, 'delaysNotes')) data.delaysNotes = optionalString(body, 'delaysNotes');
    if (has(body, 'submittedBy')) {
      // Same existence check the POST route makes, so an edit can't
      // introduce a bad worker reference the original was never allowed to.
      const submitterId = optionalString(body, 'submittedBy');
      if (submitterId) {
        const submitter = await prisma.worker.findUnique({ where: { id: submitterId } });
        if (!submitter) {
          throw new ValidationError('No worker matches the selected submitter.');
        }
      }
      data.submittedBy = submitterId;
    }

    if (Object.keys(data).length > 0) {
      await prisma.dailyLog.update({ where: { id: log.id }, data });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
