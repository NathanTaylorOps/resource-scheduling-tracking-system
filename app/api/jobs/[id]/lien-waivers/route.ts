import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LienWaiverType } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, requiredEnum, optionalNumber, NotFoundError, ValidationError } from '@/lib/validate';

/**
 * Opens a lien waiver against a job for one subcontractor's pay period —
 * always starting PENDING (see LienWaiver's status default in
 * schema.prisma). Getting a subcontractor's waiver from PENDING to RECEIVED
 * is a separate PATCH (app/api/lien-waivers/[id]/route.ts), since that's
 * the transition worth auditing, not this creation.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const subcontractorId = requiredString(body, 'subcontractorId', 'Select a subcontractor.');
    const subcontractor = await prisma.subcontractor.findUnique({ where: { id: subcontractorId } });
    if (!subcontractor) {
      throw new ValidationError('No subcontractor matches that id.');
    }
    const waiverType = requiredEnum(body, 'waiverType', LienWaiverType, 'Select a waiver type.');
    const payPeriodStart = requiredDate(body, 'payPeriodStart', 'Enter a valid pay period.');
    const payPeriodEnd = requiredDate(body, 'payPeriodEnd', 'Enter a valid pay period.');
    if (payPeriodEnd < payPeriodStart) {
      throw new ValidationError('Pay period end must be on or after its start.');
    }
    const amount = optionalNumber(body, 'amount', { min: 0 }, 'Amount must be a non-negative number.');

    const waiver = await prisma.lienWaiver.create({
      data: {
        jobId: job.id,
        subcontractorId: subcontractor.id,
        waiverType,
        payPeriodStart,
        payPeriodEnd,
        amount,
        notes: optionalString(body, 'notes'),
      },
    });

    return NextResponse.json({ id: waiver.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
