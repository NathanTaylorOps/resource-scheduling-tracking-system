import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString } from '@/lib/validate';

/**
 * Creates a new subcontractor firm. Deliberately minimal — just the two
 * fields that identify the business — since its license and COI records
 * are their own editable sections once the firm exists (see
 * SubcontractorLicenseEditor and AddCoiForm on the firm's detail page),
 * the same "create the record, fill in detail afterward" split every other
 * entity here follows.
 */
export async function POST(request: NextRequest) {
  try {
    const prisma = getDb();
    const body = await parseJsonBody(request);

    const businessName = requiredString(body, 'businessName', 'Enter a business name.');
    const trade = requiredString(body, 'trade', 'Enter a trade.');

    const subcontractor = await prisma.subcontractor.create({
      data: { businessName, trade },
    });

    return NextResponse.json({ id: subcontractor.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
