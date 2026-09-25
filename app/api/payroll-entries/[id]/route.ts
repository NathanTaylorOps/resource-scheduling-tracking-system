import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PayrollEntryStatus } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredEnum, NotFoundError } from '@/lib/validate';

/**
 * Marks a certified-payroll entry SUBMITTED once it's locked in for that
 * week's report. Not audit-logged — see AuditLogEntry's comment in
 * schema.prisma for the deliberately short list of what is.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const entry = await prisma.certifiedPayrollEntry.findUnique({ where: { id: params.id } });
    if (!entry) {
      throw new NotFoundError('No payroll entry matches that id.');
    }

    const body = await parseJsonBody(request);
    const status = requiredEnum(body, 'status', PayrollEntryStatus, 'Select a valid status.');

    const updated = await prisma.certifiedPayrollEntry.update({
      where: { id: entry.id },
      data: { status },
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return apiError(err);
  }
}
