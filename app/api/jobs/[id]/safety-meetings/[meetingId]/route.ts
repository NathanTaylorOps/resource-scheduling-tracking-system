import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Removes a mis-logged toolbox talk. A hard delete, the same treatment
 * already given to an equipment reservation cancellation — attendee rows
 * cascade with it (SafetyMeetingAttendee.onDelete: Cascade in
 * schema.prisma). Unlike a daily log, a toolbox talk is safety-culture
 * documentation rather than the kind of record a dispute or warranty
 * claim needs a paper trail on, so deleting and re-logging is the right
 * correction path here rather than an edit-in-place.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; meetingId: string } }) {
  const prisma = getDb();
  const meeting = await prisma.safetyMeeting.findUnique({ where: { id: params.meetingId } });
  if (!meeting || meeting.jobId !== params.id) {
    return NextResponse.json({ error: 'No matching toolbox talk for this job.' }, { status: 404 });
  }

  await prisma.safetyMeeting.delete({ where: { id: params.meetingId } });
  return NextResponse.json({ ok: true });
}
