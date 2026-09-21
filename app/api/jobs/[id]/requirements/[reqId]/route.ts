import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Removes one staffing-plan line. A hard delete rather than a status flag —
 * a requirement that's no longer needed shouldn't keep reading as
 * "unfilled" on the job forever.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; reqId: string } }) {
  const requirement = await prisma.jobRoleRequirement.findUnique({ where: { id: params.reqId } });
  if (!requirement || requirement.jobId !== params.id) {
    return NextResponse.json({ error: 'No matching requirement on this job.' }, { status: 404 });
  }

  await prisma.jobRoleRequirement.delete({ where: { id: params.reqId } });
  return NextResponse.json({ ok: true });
}
