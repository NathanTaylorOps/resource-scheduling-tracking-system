import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
 * requiredCertTypes is optional and stored as-is (a comma-separated string —
 * see the field's own comment in schema.prisma); it's what the assignment
 * route (app/api/jobs/[id]/assignments) checks a worker against via
 * canAssignWorker when someone's assigned to this role.
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

  const requirement = await prisma.jobRoleRequirement.create({
    data: { jobId: job.id, roleOrTrade, requiredCount, requiredCertTypes: body.requiredCertTypes?.trim() || null },
  });

  return NextResponse.json({ id: requirement.id }, { status: 201 });
}
