import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { IncidentStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';

interface UpdateIncidentBody {
  status: string;
  correctionAction?: string;
}

const VALID_STATUSES = new Set<string>(Object.values(IncidentStatus));

/**
 * Closes out (or reopens) a safety incident. Same audit rationale as
 * permit/inspection status: OSHA recordkeeping and any later claim both
 * turn on exactly this — who closed it, and when.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const incident = await prisma.safetyIncident.findUnique({ where: { id: params.id } });
  if (!incident) {
    return NextResponse.json({ error: 'No safety incident matches that id.' }, { status: 404 });
  }

  let body: UpdateIncidentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.safetyIncident.update({
      where: { id: incident.id },
      data: {
        status: body.status,
        correctionAction: body.correctionAction?.trim() || incident.correctionAction,
      },
    });
    if (incident.status !== body.status) {
      await recordAudit(tx, {
        entityType: 'SafetyIncident',
        entityId: incident.id,
        action: 'STATUS_CHANGE',
        summary: `${incident.incidentType} incident status changed from ${incident.status} to ${body.status}.`,
      });
    }
    return result;
  });

  return NextResponse.json({ id: updated.id });
}
