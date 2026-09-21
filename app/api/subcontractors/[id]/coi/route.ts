import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CoverageType } from '@/lib/enums';

interface CreateCoiBody {
  coverageType: string;
  carrier: string;
  policyNumber: string;
  effectiveDate: string;
  expiryDate: string;
  coverageLimit?: number;
  additionalInsured?: boolean;
}

const VALID_COVERAGE_TYPES = new Set<string>(Object.values(CoverageType));

/**
 * Adds a certificate-of-insurance record. Add-only, no edit or delete: a
 * COI is a record of a specific policy period, and a renewal is a new
 * record rather than an edit to the old one — the same append-only
 * reasoning ScanEvent already uses for chain-of-custody, applied here to
 * chain-of-coverage. The superseded record just stops being the one
 * getCertificationStatus reads as current once its expiryDate passes.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const subcontractor = await prisma.subcontractor.findUnique({ where: { id: params.id } });
  if (!subcontractor) {
    return NextResponse.json({ error: 'No subcontractor matches that id.' }, { status: 404 });
  }

  let body: CreateCoiBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.coverageType || !VALID_COVERAGE_TYPES.has(body.coverageType)) {
    return NextResponse.json({ error: 'Select a coverage type.' }, { status: 400 });
  }
  const carrier = body.carrier?.trim();
  const policyNumber = body.policyNumber?.trim();
  if (!carrier || !policyNumber) {
    return NextResponse.json({ error: 'Enter the carrier and policy number.' }, { status: 400 });
  }
  const effectiveDate = new Date(body.effectiveDate);
  const expiryDate = new Date(body.expiryDate);
  if (Number.isNaN(effectiveDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
    return NextResponse.json({ error: 'Enter valid effective and expiry dates.' }, { status: 400 });
  }
  if (expiryDate.getTime() <= effectiveDate.getTime()) {
    return NextResponse.json({ error: 'Expiry date must be after the effective date.' }, { status: 400 });
  }

  const coi = await prisma.subcontractorCOI.create({
    data: {
      subcontractorId: subcontractor.id,
      coverageType: body.coverageType,
      carrier,
      policyNumber,
      effectiveDate,
      expiryDate,
      coverageLimit: typeof body.coverageLimit === 'number' ? body.coverageLimit : null,
      additionalInsured: Boolean(body.additionalInsured),
    },
  });

  return NextResponse.json({ id: coi.id }, { status: 201 });
}
