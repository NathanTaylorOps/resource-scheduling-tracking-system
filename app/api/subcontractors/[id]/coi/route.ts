import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CoverageType } from '@/lib/enums';
import { apiError } from '@/lib/api';
import {
  parseJsonBody,
  requiredString,
  requiredDate,
  requiredEnum,
  optionalNumber,
  optionalBoolean,
  NotFoundError,
  ValidationError,
} from '@/lib/validate';

/**
 * Adds a certificate-of-insurance record. Add-only, no edit or delete: a
 * COI is a record of a specific policy period, and a renewal is a new
 * record rather than an edit to the old one — the same append-only
 * reasoning ScanEvent already uses for chain-of-custody, applied here to
 * chain-of-coverage. The superseded record just stops being the one
 * getCertificationStatus reads as current once its expiryDate passes.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const subcontractor = await prisma.subcontractor.findUnique({ where: { id: params.id } });
    if (!subcontractor) {
      throw new NotFoundError('No subcontractor matches that id.');
    }

    const body = await parseJsonBody(request);
    const coverageType = requiredEnum(body, 'coverageType', CoverageType, 'Select a coverage type.');
    const carrier = requiredString(body, 'carrier', 'Enter the carrier and policy number.');
    const policyNumber = requiredString(body, 'policyNumber', 'Enter the carrier and policy number.');
    const effectiveDate = requiredDate(body, 'effectiveDate', 'Enter valid effective and expiry dates.');
    const expiryDate = requiredDate(body, 'expiryDate', 'Enter valid effective and expiry dates.');
    if (expiryDate.getTime() <= effectiveDate.getTime()) {
      throw new ValidationError('Expiry date must be after the effective date.');
    }
    const coverageLimit = optionalNumber(body, 'coverageLimit', { min: 0 }, 'Coverage limit must be a non-negative number.');
    const additionalInsured = optionalBoolean(body, 'additionalInsured');

    const coi = await prisma.subcontractorCOI.create({
      data: {
        subcontractorId: subcontractor.id,
        coverageType,
        carrier,
        policyNumber,
        effectiveDate,
        expiryDate,
        coverageLimit,
        additionalInsured,
      },
    });

    return NextResponse.json({ id: coi.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
