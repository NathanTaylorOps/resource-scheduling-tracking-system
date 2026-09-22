import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { IncidentType, IncidentSeverity } from '@/lib/enums';

interface CreateIncidentBody {
  incidentType: string;
  severity: string;
  occurredAt: string;
  description: string;
  correctionAction?: string;
  reportedByWorkerId?: string;
  involvedWorkerId?: string;
}

const VALID_TYPES = new Set<string>(Object.values(IncidentType));
const VALID_SEVERITIES = new Set<string>(Object.values(IncidentSeverity));

/**
 * Logs a safety incident (or near miss — see IncidentType's comment on why
 * that's a first-class type, not a low-severity injury) against a job,
 * always starting OPEN. Closing one out is the separate PATCH at
 * app/api/safety-incidents/[id]/route.ts.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateIncidentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.incidentType || !VALID_TYPES.has(body.incidentType)) {
    return NextResponse.json({ error: 'Select an incident type.' }, { status: 400 });
  }
  if (!body.severity || !VALID_SEVERITIES.has(body.severity)) {
    return NextResponse.json({ error: 'Select a severity.' }, { status: 400 });
  }
  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Enter a valid date/time.' }, { status: 400 });
  }
  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json({ error: 'Describe what happened.' }, { status: 400 });
  }
  if (body.reportedByWorkerId) {
    const worker = await prisma.worker.findUnique({ where: { id: body.reportedByWorkerId } });
    if (!worker) {
      return NextResponse.json({ error: 'No worker matches the reporting worker id.' }, { status: 400 });
    }
  }
  if (body.involvedWorkerId) {
    const worker = await prisma.worker.findUnique({ where: { id: body.involvedWorkerId } });
    if (!worker) {
      return NextResponse.json({ error: 'No worker matches the involved worker id.' }, { status: 400 });
    }
  }

  const incident = await prisma.safetyIncident.create({
    data: {
      jobId: job.id,
      incidentType: body.incidentType,
      severity: body.severity,
      occurredAt,
      description,
      correctionAction: body.correctionAction?.trim() || null,
      reportedByWorkerId: body.reportedByWorkerId || null,
      involvedWorkerId: body.involvedWorkerId || null,
    },
  });

  return NextResponse.json({ id: incident.id }, { status: 201 });
}
