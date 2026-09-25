import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { InspectionStatus, ReinspectionChannel } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, optionalString, optionalDate, requiredEnum, optionalEnum, NotFoundError } from '@/lib/validate';

/**
 * Records an inspection's actual outcome — the write side of the
 * failed-inspection correction detail the job-detail page displays
 * (correction notes, who's responsible, how re-inspection gets scheduled).
 * One row updated in place, the same simplification the schema comment on
 * Inspection documents, not a full visit-by-visit history.
 *
 * A PATCH touches only the fields the client sent, with one deliberate
 * exception: correction detail only means something on a FAILED
 * inspection, so whenever the resulting status isn't FAILED those four
 * fields are cleared, keeping a stale correction note from lingering on an
 * inspection that later passed.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const inspection = await prisma.inspection.findUnique({ where: { id: params.id } });
    if (!inspection) {
      throw new NotFoundError('No inspection matches that id.');
    }

    const body = await parseJsonBody(request);
    const data: {
      status?: string;
      scheduledDate?: Date | null;
      completedDate?: Date | null;
      inspectorNotes?: string | null;
      correctionNotes?: string | null;
      correctionResponsible?: string | null;
      reinspectionChannel?: string | null;
      reinspectionScheduledDate?: Date | null;
    } = {};

    if (has(body, 'status')) data.status = requiredEnum(body, 'status', InspectionStatus, 'Select a valid status.');
    if (has(body, 'scheduledDate')) data.scheduledDate = optionalDate(body, 'scheduledDate', 'One of the dates entered is not valid.');
    if (has(body, 'completedDate')) data.completedDate = optionalDate(body, 'completedDate', 'One of the dates entered is not valid.');
    if (has(body, 'inspectorNotes')) data.inspectorNotes = optionalString(body, 'inspectorNotes');

    const effectiveStatus = data.status ?? inspection.status;
    if (effectiveStatus === InspectionStatus.FAILED) {
      if (has(body, 'correctionNotes')) data.correctionNotes = optionalString(body, 'correctionNotes');
      if (has(body, 'correctionResponsible')) data.correctionResponsible = optionalString(body, 'correctionResponsible');
      if (has(body, 'reinspectionChannel')) {
        const channel = optionalString(body, 'reinspectionChannel');
        data.reinspectionChannel = channel
          ? optionalEnum(body, 'reinspectionChannel', ReinspectionChannel, ReinspectionChannel.IN_PERSON, 'Select a valid re-inspection channel.')
          : null;
      }
      if (has(body, 'reinspectionScheduledDate')) {
        data.reinspectionScheduledDate = optionalDate(body, 'reinspectionScheduledDate', 'One of the dates entered is not valid.');
      }
    } else {
      data.correctionNotes = null;
      data.correctionResponsible = null;
      data.reinspectionChannel = null;
      data.reinspectionScheduledDate = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inspection.update({ where: { id: inspection.id }, data });
      // Same reasoning as the permit-status audit entry — an inspection
      // outcome (especially a FAILED one) is exactly the kind of fact a
      // claim or dispute years later turns on.
      if (data.status !== undefined && inspection.status !== data.status) {
        await recordAudit(tx, {
          entityType: 'Inspection',
          entityId: inspection.id,
          action: 'STATUS_CHANGE',
          summary: `${inspection.inspectionType} inspection status changed from ${inspection.status} to ${data.status}.`,
        });
      }
      return result;
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return apiError(err);
  }
}
