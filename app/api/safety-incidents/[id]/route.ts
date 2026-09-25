import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { IncidentStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, optionalString, requiredEnum, NotFoundError } from '@/lib/validate';

/**
 * Closes out (or reopens) a safety incident. Same audit rationale as
 * permit/inspection status: OSHA recordkeeping and any later claim both
 * turn on exactly this — who closed it, and when.
 *
 * A PATCH touches only the fields the client sent.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const incident = await prisma.safetyIncident.findUnique({ where: { id: params.id } });
    if (!incident) {
      throw new NotFoundError('No safety incident matches that id.');
    }

    const body = await parseJsonBody(request);
    const data: { status?: string; correctionAction?: string | null } = {};

    if (has(body, 'status')) data.status = requiredEnum(body, 'status', IncidentStatus, 'Select a valid status.');
    if (has(body, 'correctionAction')) data.correctionAction = optionalString(body, 'correctionAction');

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id: incident.id });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.safetyIncident.update({ where: { id: incident.id }, data });
      if (data.status !== undefined && incident.status !== data.status) {
        await recordAudit(tx, {
          entityType: 'SafetyIncident',
          entityId: incident.id,
          action: 'STATUS_CHANGE',
          summary: `${incident.incidentType} incident status changed from ${incident.status} to ${data.status}.`,
        });
      }
      return result;
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return apiError(err);
  }
}
