import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, optionalStringArray, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Logs a toolbox talk — documentation of safety culture (who ran it, who
 * was there), not a compliance gate, same as the read side: doesn't feed
 * readiness. Attendee rows are written in the same transaction as the
 * meeting so a partial write can't leave a meeting with no attendee record
 * at all.
 *
 * conductedBy and every id in attendeeWorkerIds are worker ids chosen from
 * a picker sourced from this job's own crew, but nothing stops a stale or
 * hand-crafted request naming one that no longer exists — checked up front
 * so a bad id comes back as a clear 400 instead of a raw foreign-key
 * constraint failure.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const topic = requiredString(body, 'topic', 'Enter the topic covered.');
    const conductedBy = requiredString(body, 'conductedBy', 'Select who led the talk.');
    const conductor = await prisma.worker.findUnique({ where: { id: conductedBy } });
    if (!conductor) {
      throw new ValidationError('No worker matches the selected leader.');
    }
    const meetingDate = requiredDate(body, 'meetingDate', 'Enter a valid date.');

    const attendeeWorkerIds = optionalStringArray(body, 'attendeeWorkerIds', 'Attendees must be a list of worker ids.');
    if (attendeeWorkerIds.length > 0) {
      const matchingCount = await prisma.worker.count({ where: { id: { in: attendeeWorkerIds } } });
      if (matchingCount !== attendeeWorkerIds.length) {
        throw new ValidationError('One or more selected attendees no longer match a worker on file.');
      }
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const created = await tx.safetyMeeting.create({
        data: { jobId: job.id, meetingDate, topic, conductedBy: conductor.id },
      });
      if (attendeeWorkerIds.length > 0) {
        await tx.safetyMeetingAttendee.createMany({
          data: attendeeWorkerIds.map((workerId) => ({ safetyMeetingId: created.id, workerId })),
        });
      }
      return created;
    });

    return NextResponse.json({ id: meeting.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
