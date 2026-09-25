import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { NotFoundError } from '@/lib/validate';

/**
 * Removes one staffing-plan line. A hard delete rather than a status flag —
 * a requirement that's no longer needed shouldn't keep reading as
 * "unfilled" on the job forever.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; reqId: string } }) {
  try {
    const prisma = getDb();
    const requirement = await prisma.jobRoleRequirement.findUnique({ where: { id: params.reqId } });
    if (!requirement || requirement.jobId !== params.id) {
      throw new NotFoundError('No matching requirement on this job.');
    }

    await prisma.jobRoleRequirement.delete({ where: { id: params.reqId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
