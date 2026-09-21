import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCertTypesList } from '@/lib/domain/certifications';

interface CreateRequirementBody {
  roleOrTrade: string;
  requiredCount?: number;
  requiredCertTypes?: string;
}

/**
 * Adds one row to a job's staffing plan. Deliberately simple — a role/trade
 * name and a headcount, matched against Assignment.roleOnJob by exact string
 * elsewhere (see findUnfilledRoles in lib/domain/scheduling.ts), so the
 * value typed here has to match how crew actually get assigned on this job,
 * the same plan-versus-actual pattern the README describes.
 *
 * requiredCertTypes is optional, parsed through the same parseCertTypesList
 * the assignments route reads it back with (see that function's own
 * comment), and stored in its normalized "X, Y, Z" form — or not stored at
 * all if nothing survives parsing — rather than saving whatever was typed
 * verbatim. It's what the assignment route (app/api/jobs/[id]/assignments)
 * checks a worker against via canAssignWorker when someone's assigned to
 * this role.
 *
 * One row per role per job (see the @@unique on JobRoleRequirement in
 * schema.prisma): a second row for a role that already has one would let
 * the assignments route's findFirst silently pick between two requirements
 * with possibly different required certs, so it's rejected here instead.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateRequirementBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const roleOrTrade = body.roleOrTrade?.trim();
  if (!roleOrTrade) {
    return NextResponse.json({ error: 'Enter a role or trade.' }, { status: 400 });
  }
  const requiredCount = body.requiredCount ?? 1;
  if (!Number.isInteger(requiredCount) || requiredCount < 1) {
    return NextResponse.json({ error: 'Required count must be a whole number of at least 1.' }, { status: 400 });
  }

  const existing = await prisma.jobRoleRequirement.findFirst({ where: { jobId: job.id, roleOrTrade } });
  if (existing) {
    return NextResponse.json(
      { error: `${roleOrTrade} already has a staffing requirement on this job. Remove it below before adding a replacement.` },
      { status: 409 },
    );
  }

  const parsedCertTypes = parseCertTypesList(body.requiredCertTypes);
  const requirement = await prisma.jobRoleRequirement.create({
    data: {
      jobId: job.id,
      roleOrTrade,
      requiredCount,
      requiredCertTypes: parsedCertTypes.length > 0 ? parsedCertTypes.join(', ') : null,
    },
  });

  return NextResponse.json({ id: requirement.id }, { status: 201 });
}
