import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, has, requiredString, optionalString, optionalDate, NotFoundError } from '@/lib/validate';

/**
 * Updates a subcontractor firm's trade-license fields in place — unlike a
 * COI record, there's only ever one current license per firm in this
 * model, so a renewal overwrites rather than adding a new row.
 *
 * A PATCH touches only the fields the client sent. A key sent as null or
 * blank clears that field; a key left out leaves it as it was.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const subcontractor = await prisma.subcontractor.findUnique({ where: { id: params.id } });
    if (!subcontractor) {
      throw new NotFoundError('No subcontractor matches that id.');
    }

    const body = await parseJsonBody(request);
    const data: {
      licenseNumber?: string;
      licenseClass?: string | null;
      licenseIssuingAuthority?: string;
      licenseExpiryDate?: Date | null;
    } = {};

    if (has(body, 'licenseNumber')) data.licenseNumber = requiredString(body, 'licenseNumber', 'Enter the license number.');
    if (has(body, 'licenseClass')) data.licenseClass = optionalString(body, 'licenseClass');
    if (has(body, 'licenseIssuingAuthority')) {
      data.licenseIssuingAuthority = requiredString(body, 'licenseIssuingAuthority', 'Enter the issuing authority.');
    }
    if (has(body, 'licenseExpiryDate')) data.licenseExpiryDate = optionalDate(body, 'licenseExpiryDate', 'Enter a valid expiry date.');

    if (Object.keys(data).length > 0) {
      await prisma.subcontractor.update({ where: { id: subcontractor.id }, data });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
