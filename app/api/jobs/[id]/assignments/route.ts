import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { canAssignWorker, parseCertTypesList } from '@/lib/domain/certifications';

interface CreateAssignmentBody {
  workerId: string;
  roleOnJob: string;
  start: string;
  end: string;
}

/**
 * Assigns a worker to a job for a role and date range.
 *
 * Certification eligibility is a hard stop, not a warning — the README's
 * own claim ("a hard stop on assigning someone to a role that requires a
 * certification they don't currently hold") only holds if this route
 * actually enforces it. The required cert types come from this job's
 * JobRoleRequirement for the same roleOnJob, if one exists and has
 * requiredCertTypes set (see that field's comment in schema.prisma); a role
 * with no matching requirement, or a requirement with no required certs
 * listed, has nothing to check and always passes.
 *
 * A double-booking, by contrast, is NOT blocked here — the same
 * intentional choice the equipment-reservation route already makes (see
 * its own comment): a scheduling conflict should surface as a visible flag
 * (the job detail page's existing findOverlaps check does this the moment
 * the page next renders), not be silently prevented, since a real PM
 * sometimes needs to book over a conflict on purpose and sort it out.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateAssignmentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.workerId) {
    return NextResponse.json({ error: 'Select a worker.' }, { status: 400 });
  }
  const roleOnJob = body.roleOnJob?.trim();
  if (!roleOnJob) {
    return NextResponse.json({ error: 'Enter the role this assignment is for.' }, { status: 400 });
  }
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Enter valid start and end dates.' }, { status: 400 });
  }
  if (end.getTime() <= start.getTime()) {
    return NextResponse.json({ error: 'End date must be after the start date.' }, { status: 400 });
  }

  const worker = await prisma.worker.findUnique({
    where: { id: body.workerId },
    include: { certifications: true },
  });
  if (!worker) {
    return NextResponse.json({ error: 'No worker matches that selection.' }, { status: 400 });
  }

  // findFirst is safe here because @@unique([jobId, roleOrTrade]) on
  // JobRoleRequirement (schema.prisma) guarantees at most one row can match —
  // this can never silently pick between two requirements for the same role.
  const requirement = await prisma.jobRoleRequirement.findFirst({
    where: { jobId: job.id, roleOrTrade: roleOnJob },
  });
  const requiredCertTypes = parseCertTypesList(requirement?.requiredCertTypes);

  if (requiredCertTypes.length > 0) {
    const eligibility = canAssignWorker(requiredCertTypes, worker.certifications, new Date());
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: `${worker.name} is missing or has an expired required certification: ${eligibility.missingOrExpired.join(', ')}.`,
        },
        { status: 409 },
      );
    }
  }

  const assignment = await prisma.assignment.create({
    data: { workerId: worker.id, jobId: job.id, roleOnJob, start, end },
  });

  return NextResponse.json({ id: assignment.id }, { status: 201 });
}
