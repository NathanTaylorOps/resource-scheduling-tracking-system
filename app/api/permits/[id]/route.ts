import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PermitStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, optionalString, optionalDate, requiredEnum, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Advances a permit past its initial filing: mark it issued, record the
 * permit number once known, set its expiry, or file a renewal (a new
 * expiryDate on the same permit — it's the same permit continuing, and this
 * keeps its inspection history attached to the one row a PM tracks).
 * app/api/jobs/[id]/permits/route.ts only ever creates a permit at APPLIED,
 * so without this route the "expired permit blocks the job" gate could
 * never be exercised from the UI.
 *
 * A PATCH touches only the fields the client sent. A key sent as null or
 * blank clears that field; a key left out leaves it as it was.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const permit = await prisma.permit.findUnique({ where: { id: params.id } });
    if (!permit) {
      throw new NotFoundError('No permit matches that id.');
    }

    const body = await parseJsonBody(request);
    const data: {
      status?: string;
      permitNumber?: string | null;
      issuedDate?: Date | null;
      expiryDate?: Date | null;
    } = {};

    if (has(body, 'status')) data.status = requiredEnum(body, 'status', PermitStatus, 'Select a valid permit status.');
    if (has(body, 'permitNumber')) data.permitNumber = optionalString(body, 'permitNumber');
    if (has(body, 'issuedDate')) data.issuedDate = optionalDate(body, 'issuedDate', 'One of the dates entered is not valid.');
    if (has(body, 'expiryDate')) data.expiryDate = optionalDate(body, 'expiryDate', 'One of the dates entered is not valid.');

    // EXPIRED is meant to be derived from expiryDate (see isPastCalendarDate
    // in lib/domain/readiness.ts) rather than hand-set — a status of EXPIRED
    // with no expiryDate to back it up is one readiness can't reconstruct
    // from data the next time it's computed. ISSUED and FINALED need no
    // such backing fact, so they're free to set directly.
    const effectiveStatus = data.status ?? permit.status;
    const effectiveExpiry = has(body, 'expiryDate') ? data.expiryDate : permit.expiryDate;
    if (effectiveStatus === PermitStatus.EXPIRED && !effectiveExpiry) {
      throw new ValidationError('Set an expiry date in the past instead of marking a permit expired directly.');
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id: permit.id });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.permit.update({ where: { id: permit.id }, data });
      // Permit status is exactly the kind of fact that shows up in a
      // deposition years after a job closes — "who marked this ISSUED, and
      // when" — so this is one of the handful of mutations wired to
      // lib/audit.ts.
      if (data.status !== undefined && permit.status !== data.status) {
        await recordAudit(tx, {
          entityType: 'Permit',
          entityId: permit.id,
          action: 'STATUS_CHANGE',
          summary: `Status changed from ${permit.status} to ${data.status}.`,
        });
      }
      return result;
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return apiError(err);
  }
}
