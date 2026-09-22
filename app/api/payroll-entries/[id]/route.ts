import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PayrollEntryStatus } from '@/lib/enums';

interface UpdatePayrollEntryBody {
  status: string;
}

const VALID_STATUSES = new Set<string>(Object.values(PayrollEntryStatus));

/**
 * Marks a certified-payroll entry SUBMITTED once it's locked in for that
 * week's report. Not audit-logged — see AuditLogEntry's comment in
 * schema.prisma for the deliberately short list of what is.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const entry = await prisma.certifiedPayrollEntry.findUnique({ where: { id: params.id } });
  if (!entry) {
    return NextResponse.json({ error: 'No payroll entry matches that id.' }, { status: 404 });
  }

  let body: UpdatePayrollEntryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }

  const updated = await prisma.certifiedPayrollEntry.update({
    where: { id: entry.id },
    data: { status: body.status },
  });

  return NextResponse.json({ id: updated.id });
}
