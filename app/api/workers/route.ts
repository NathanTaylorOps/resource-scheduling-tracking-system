import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { EmploymentType } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, optionalEnum, ValidationError } from '@/lib/validate';

/**
 * Creates a new worker. subcontractorId is required when employmentType is
 * SUBCONTRACTOR, and simply ignored otherwise — not rejected as a bad
 * request, just dropped, since a stray value left over from switching the
 * employment-type select shouldn't block an otherwise-valid direct-employee
 * save. A direct employee's compliance is entirely personal
 * (WorkerCertification), so linking one to a firm would misrepresent whose
 * insurance and license actually gate their eligibility to work (see the
 * Worker/Subcontractor relation's own comment in schema.prisma).
 */
export async function POST(request: NextRequest) {
  try {
    const prisma = getDb();
    const body = await parseJsonBody(request);

    const name = requiredString(body, 'name', 'Enter a name.');
    const trade = requiredString(body, 'trade', 'Enter a trade.');
    const hireDate = requiredDate(body, 'hireDate', 'Enter a valid hire date.');
    const employmentType = optionalEnum(body, 'employmentType', EmploymentType, EmploymentType.DIRECT_EMPLOYEE, 'Select a valid employment type.');

    let subcontractorId: string | null = null;
    if (employmentType === EmploymentType.SUBCONTRACTOR) {
      const requestedId = optionalString(body, 'subcontractorId');
      if (!requestedId) {
        throw new ValidationError('Select the subcontractor firm this worker belongs to.');
      }
      const subcontractor = await prisma.subcontractor.findUnique({ where: { id: requestedId } });
      if (!subcontractor) {
        throw new ValidationError('No subcontractor firm matches that selection.');
      }
      subcontractorId = subcontractor.id;
    }

    const worker = await prisma.worker.create({
      data: {
        name,
        trade,
        employmentType,
        hireDate,
        phone: optionalString(body, 'phone'),
        email: optionalString(body, 'email'),
        subcontractorId,
      },
    });

    return NextResponse.json({ id: worker.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
