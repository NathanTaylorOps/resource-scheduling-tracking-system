import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InspectionStatus, ReinspectionChannel } from '@/lib/enums';

interface UpdateInspectionBody {
  status: string;
  scheduledDate?: string;
  completedDate?: string;
  inspectorNotes?: string;
  correctionNotes?: string;
  correctionResponsible?: string;
  reinspectionChannel?: string;
  reinspectionScheduledDate?: string;
}

const VALID_STATUSES = new Set<string>(Object.values(InspectionStatus));
const VALID_CHANNELS = new Set<string>(Object.values(ReinspectionChannel));

/**
 * Records an inspection's actual outcome — this is the write side of the
 * failed-inspection correction detail the job-detail page already displays
 * read-only (correction notes, who's responsible, how re-inspection gets
 * scheduled). Kept as one row updated in place, the same simplification the
 * schema comment on Inspection already documents, not a full visit-by-visit
 * history.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const inspection = await prisma.inspection.findUnique({ where: { id: params.id } });
  if (!inspection) {
    return NextResponse.json({ error: 'No inspection matches that id.' }, { status: 404 });
  }

  let body: UpdateInspectionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }
  if (body.reinspectionChannel && !VALID_CHANNELS.has(body.reinspectionChannel)) {
    return NextResponse.json({ error: 'Select a valid re-inspection channel.' }, { status: 400 });
  }

  const parseDate = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const scheduledDate = parseDate(body.scheduledDate);
  const completedDate = parseDate(body.completedDate);
  const reinspectionScheduledDate = parseDate(body.reinspectionScheduledDate);
  if (scheduledDate === undefined || completedDate === undefined || reinspectionScheduledDate === undefined) {
    return NextResponse.json({ error: 'One of the dates entered is not valid.' }, { status: 400 });
  }

  const updated = await prisma.inspection.update({
    where: { id: inspection.id },
    data: {
      status: body.status,
      scheduledDate,
      completedDate,
      inspectorNotes: body.inspectorNotes?.trim() || null,
      // Correction detail only means something on a failed inspection —
      // clearing it here if the status has moved off FAILED keeps a stale
      // correction note from lingering on an inspection that later passed.
      correctionNotes: body.status === InspectionStatus.FAILED ? body.correctionNotes?.trim() || null : null,
      correctionResponsible: body.status === InspectionStatus.FAILED ? body.correctionResponsible?.trim() || null : null,
      reinspectionChannel: body.status === InspectionStatus.FAILED ? body.reinspectionChannel || null : null,
      reinspectionScheduledDate: body.status === InspectionStatus.FAILED ? reinspectionScheduledDate : null,
    },
  });

  return NextResponse.json({ id: updated.id });
}
