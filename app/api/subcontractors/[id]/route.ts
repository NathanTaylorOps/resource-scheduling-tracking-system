import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface UpdateLicenseBody {
  licenseNumber?: string;
  licenseClass?: string;
  licenseIssuingAuthority?: string;
  licenseExpiryDate?: string;
}

/**
 * Updates a subcontractor firm's trade-license fields in place — unlike a
 * COI record, there's only ever one current license per firm in this
 * model, so a renewal overwrites rather than adding a new row.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const subcontractor = await prisma.subcontractor.findUnique({ where: { id: params.id } });
  if (!subcontractor) {
    return NextResponse.json({ error: 'No subcontractor matches that id.' }, { status: 404 });
  }

  let body: UpdateLicenseBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const licenseNumber = body.licenseNumber?.trim();
  if (!licenseNumber) {
    return NextResponse.json({ error: 'Enter the license number.' }, { status: 400 });
  }
  const licenseIssuingAuthority = body.licenseIssuingAuthority?.trim();
  if (!licenseIssuingAuthority) {
    return NextResponse.json({ error: 'Enter the issuing authority.' }, { status: 400 });
  }
  const licenseExpiryDate = body.licenseExpiryDate ? new Date(body.licenseExpiryDate) : null;
  if (body.licenseExpiryDate && Number.isNaN(licenseExpiryDate?.getTime())) {
    return NextResponse.json({ error: 'Enter a valid expiry date.' }, { status: 400 });
  }

  await prisma.subcontractor.update({
    where: { id: subcontractor.id },
    data: {
      licenseNumber,
      licenseClass: body.licenseClass?.trim() || null,
      licenseIssuingAuthority,
      licenseExpiryDate,
    },
  });

  return NextResponse.json({ ok: true });
}
