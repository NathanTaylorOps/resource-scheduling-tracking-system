import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LienWaiverType } from '@/lib/enums';

interface CreateLienWaiverBody {
  subcontractorId: string;
  waiverType: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  amount?: number;
  notes?: string;
}

const VALID_WAIVER_TYPES = new Set<string>(Object.values(LienWaiverType));

/**
 * Opens a lien waiver against a job for one subcontractor's pay period —
 * always starting PENDING (see LienWaiver's status default in
 * schema.prisma). Getting a subcontractor's waiver from PENDING to RECEIVED
 * is a separate PATCH (app/api/lien-waivers/[id]/route.ts), since that's
 * the transition worth auditing, not this creation.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateLienWaiverBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.subcontractorId) {
    return NextResponse.json({ error: 'Select a subcontractor.' }, { status: 400 });
  }
  const subcontractor = await prisma.subcontractor.findUnique({ where: { id: body.subcontractorId } });
  if (!subcontractor) {
    return NextResponse.json({ error: 'No subcontractor matches that id.' }, { status: 400 });
  }
  if (!body.waiverType || !VALID_WAIVER_TYPES.has(body.waiverType)) {
    return NextResponse.json({ error: 'Select a waiver type.' }, { status: 400 });
  }
  const payPeriodStart = new Date(body.payPeriodStart);
  const payPeriodEnd = new Date(body.payPeriodEnd);
  if (Number.isNaN(payPeriodStart.getTime()) || Number.isNaN(payPeriodEnd.getTime())) {
    return NextResponse.json({ error: 'Enter a valid pay period.' }, { status: 400 });
  }
  if (payPeriodEnd < payPeriodStart) {
    return NextResponse.json({ error: 'Pay period end must be on or after its start.' }, { status: 400 });
  }
  if (body.amount !== undefined && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0)) {
    return NextResponse.json({ error: 'Amount must be a non-negative number.' }, { status: 400 });
  }

  const waiver = await prisma.lienWaiver.create({
    data: {
      jobId: job.id,
      subcontractorId: subcontractor.id,
      waiverType: body.waiverType,
      payPeriodStart,
      payPeriodEnd,
      amount: body.amount ?? null,
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({ id: waiver.id }, { status: 201 });
}
