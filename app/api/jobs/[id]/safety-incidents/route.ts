import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { IncidentType, IncidentSeverity } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, requiredEnum, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Logs a safety incident (or near miss — see IncidentType's comment on why
 * that's a first-class type, not a low-severity injury) against a job,
 * always starting OPEN. Closing one out is the separate PATCH at
 * app/api/safety-incidents/[id]/route.ts.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const incidentType = requiredEnum(body, 'incidentType', IncidentType, 'Select an incident type.');
    const severity = requiredEnum(body, 'severity', IncidentSeverity, 'Select a severity.');
    const occurredAt = requiredDate(body, 'occurredAt', 'Enter a valid date/time.');
    const description = requiredString(body, 'description', 'Describe what happened.');
    const reportedByWorkerId = optionalString(body, 'reportedByWorkerId');
    if (reportedByWorkerId) {
      const worker = await prisma.worker.findUnique({ where: { id: reportedByWorkerId } });
      if (!worker) {
        throw new ValidationError('No worker matches the reporting worker id.');
      }
    }
    const involvedWorkerId = optionalString(body, 'involvedWorkerId');
    if (involvedWorkerId) {
      const worker = await prisma.worker.findUnique({ where: { id: involvedWorkerId } });
      if (!worker) {
        throw new ValidationError('No worker matches the involved worker id.');
      }
    }

    const incident = await prisma.safetyIncident.create({
      data: {
        jobId: job.id,
        incidentType,
        severity,
        occurredAt,
        description,
        correctionAction: optionalString(body, 'correctionAction'),
        reportedByWorkerId,
        involvedWorkerId,
      },
    });

    return NextResponse.json({ id: incident.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
