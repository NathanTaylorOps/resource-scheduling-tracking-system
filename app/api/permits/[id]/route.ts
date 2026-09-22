import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PermitStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';

interface UpdatePermitBody {
  status: string;
  permitNumber?: string;
  issuedDate?: string;
  expiryDate?: string;
}

const VALID_STATUSES = new Set<string>(Object.values(PermitStatus));

/**
 * Advances a permit past its initial filing — the workflow gap the app
 * previously had no route for at all: app/api/jobs/[id]/permits/route.ts
 * only ever creates a permit starting at APPLIED with no permitNumber,
 * issuedDate, or expiryDate, and nothing let a PM record that a jurisdiction
 * actually issued it, assign the permit number once known, set its expiry,
 * or file a renewal (a new expiryDate on the same permit — see the comment
 * below on why a renewal isn't a new row). Without this route, the
 * "expired permit blocks the job" gate the README describes could compute
 * from seed data but could never actually be exercised from the UI: no
 * permit could ever reach ISSUED with a real expiryDate through the app
 * itself.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const permit = await prisma.permit.findUnique({ where: { id: params.id } });
  if (!permit) {
    return NextResponse.json({ error: 'No permit matches that id.' }, { status: 404 });
  }

  let body: UpdatePermitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Select a valid permit status.' }, { status: 400 });
  }

  const parseDate = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const issuedDate = parseDate(body.issuedDate);
  const expiryDate = parseDate(body.expiryDate);
  if (issuedDate === undefined || expiryDate === undefined) {
    return NextResponse.json({ error: 'One of the dates entered is not valid.' }, { status: 400 });
  }

  // EXPIRED is meant to be derived from expiryDate (see isPastCalendarDate
  // in lib/readiness-service.ts) rather than hand-set — a status of EXPIRED
  // with no expiryDate to back it up would be a status readiness can't
  // actually reconstruct from data the next time it's computed. ISSUED and
  // FINALED need no such backing fact, so they're free to set directly.
  if (body.status === PermitStatus.EXPIRED && !expiryDate) {
    return NextResponse.json(
      { error: 'Set an expiry date in the past instead of marking a permit expired directly.' },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.permit.update({
      where: { id: permit.id },
      data: {
        status: body.status,
        permitNumber: body.permitNumber?.trim() || null,
        issuedDate,
        expiryDate,
      },
    });
    // Permit status is exactly the kind of fact that shows up in a
    // deposition years after a job closes — "who marked this ISSUED, and
    // when" — so this is one of the handful of mutations wired to
    // lib/audit.ts. See that file and AuditLogEntry's own comment for what
    // this does and doesn't guarantee.
    if (permit.status !== body.status) {
      await recordAudit(tx, {
        entityType: 'Permit',
        entityId: permit.id,
        action: 'STATUS_CHANGE',
        summary: `Status changed from ${permit.status} to ${body.status}.`,
      });
    }
    return result;
  });

  return NextResponse.json({ id: updated.id });
}
