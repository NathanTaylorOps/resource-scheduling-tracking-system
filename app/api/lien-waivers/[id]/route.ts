import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LienWaiverStatus } from '@/lib/enums';
import { recordAudit } from '@/lib/audit';

interface UpdateLienWaiverBody {
  status: string;
  receivedDate?: string;
  notes?: string;
}

const VALID_STATUSES = new Set<string>(Object.values(LienWaiverStatus));

/**
 * Advances a lien waiver's status — PENDING to RECEIVED once the
 * subcontractor's signed waiver is actually in hand, or to DISPUTED if
 * they contest an amount. Same audit rationale as permit status: this is
 * exactly the fact a payment dispute turns on months later.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const waiver = await prisma.lienWaiver.findUnique({ where: { id: params.id } });
  if (!waiver) {
    return NextResponse.json({ error: 'No lien waiver matches that id.' }, { status: 404 });
  }

  let body: UpdateLienWaiverBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Select a valid status.' }, { status: 400 });
  }

  const parseDate = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const receivedDate = parseDate(body.receivedDate);
  if (receivedDate === undefined) {
    return NextResponse.json({ error: 'Enter a valid received date.' }, { status: 400 });
  }
  if (body.status === LienWaiverStatus.RECEIVED && !receivedDate) {
    return NextResponse.json({ error: 'Set a received date to mark a waiver received.' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lienWaiver.update({
      where: { id: waiver.id },
      data: {
        status: body.status,
        receivedDate: body.status === LienWaiverStatus.RECEIVED ? receivedDate : waiver.receivedDate,
        notes: body.notes?.trim() || null,
      },
    });
    if (waiver.status !== body.status) {
      await recordAudit(tx, {
        entityType: 'LienWaiver',
        entityId: waiver.id,
        action: 'STATUS_CHANGE',
        summary: `Status changed from ${waiver.status} to ${body.status}.`,
      });
    }
    return result;
  });

  return NextResponse.json({ id: updated.id });
}
