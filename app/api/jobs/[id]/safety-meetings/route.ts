import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface CreateSafetyMeetingBody {
  meetingDate: string;
  topic: string;
  conductedBy: string;
  attendeeWorkerIds: string[];
}

/**
 * Logs a toolbox talk — documentation of safety culture (who ran it, who
 * was there), not a compliance gate, same as the read side: doesn't feed
 * readiness. Attendee rows are written in the same transaction as the
 * meeting so a partial write can't leave a meeting with no attendee record
 * at all.
 *
 * conductedBy and every id in attendeeWorkerIds are worker ids chosen from
 * a picker sourced from this job's own crew, but nothing stops a stale or
 * hand-crafted request naming one that no longer exists — checked up front,
 * the same way the assignments and daily-log routes validate their own
 * worker references, so a bad id comes back as a clear 400 instead of a
 * raw foreign-key constraint failure.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateSafetyMeetingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: 'Enter the topic covered.' }, { status: 400 });
  }
  if (!body.conductedBy) {
    return NextResponse.json({ error: 'Select who led the talk.' }, { status: 400 });
  }
  const conductor = await prisma.worker.findUnique({ where: { id: body.conductedBy } });
  if (!conductor) {
    return NextResponse.json({ error: 'No worker matches the selected leader.' }, { status: 400 });
  }
  const meetingDate = new Date(body.meetingDate);
  if (Number.isNaN(meetingDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid date.' }, { status: 400 });
  }

  const attendeeWorkerIds = [...new Set(body.attendeeWorkerIds ?? [])];
  if (attendeeWorkerIds.length > 0) {
    const matchingCount = await prisma.worker.count({ where: { id: { in: attendeeWorkerIds } } });
    if (matchingCount !== attendeeWorkerIds.length) {
      return NextResponse.json({ error: 'One or more selected attendees no longer match a worker on file.' }, { status: 400 });
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
}
