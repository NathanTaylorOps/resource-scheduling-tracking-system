import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface CreateSubcontractorBody {
  businessName: string;
  trade: string;
}

/**
 * Creates a new subcontractor firm. Deliberately minimal — just the two
 * fields that identify the business — since its license and COI records
 * are their own editable sections once the firm exists (see
 * SubcontractorLicenseEditor and AddCoiForm on the firm's detail page),
 * the same "create the record, fill in detail afterward" split every other
 * entity here follows.
 */
export async function POST(request: NextRequest) {
  let body: CreateSubcontractorBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const businessName = body.businessName?.trim();
  if (!businessName) {
    return NextResponse.json({ error: 'Enter a business name.' }, { status: 400 });
  }
  const trade = body.trade?.trim();
  if (!trade) {
    return NextResponse.json({ error: 'Enter a trade.' }, { status: 400 });
  }

  const subcontractor = await prisma.subcontractor.create({
    data: { businessName, trade },
  });

  return NextResponse.json({ id: subcontractor.id }, { status: 201 });
}
