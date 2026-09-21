import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EmploymentType } from '@/lib/enums';

interface CreateWorkerBody {
  name: string;
  trade: string;
  employmentType?: string;
  hireDate: string;
  phone?: string;
  email?: string;
  subcontractorId?: string;
}

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
  let body: CreateWorkerBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Enter a name.' }, { status: 400 });
  }
  const trade = body.trade?.trim();
  if (!trade) {
    return NextResponse.json({ error: 'Enter a trade.' }, { status: 400 });
  }
  const hireDate = new Date(body.hireDate);
  if (Number.isNaN(hireDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid hire date.' }, { status: 400 });
  }
  const employmentType =
    body.employmentType && Object.values(EmploymentType).includes(body.employmentType as EmploymentType)
      ? body.employmentType
      : EmploymentType.DIRECT_EMPLOYEE;

  let subcontractorId: string | null = null;
  if (employmentType === EmploymentType.SUBCONTRACTOR) {
    if (!body.subcontractorId) {
      return NextResponse.json({ error: 'Select the subcontractor firm this worker belongs to.' }, { status: 400 });
    }
    const subcontractor = await prisma.subcontractor.findUnique({ where: { id: body.subcontractorId } });
    if (!subcontractor) {
      return NextResponse.json({ error: 'No subcontractor firm matches that selection.' }, { status: 400 });
    }
    subcontractorId = subcontractor.id;
  }

  const worker = await prisma.worker.create({
    data: {
      name,
      trade,
      employmentType,
      hireDate,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      subcontractorId,
    },
  });

  return NextResponse.json({ id: worker.id }, { status: 201 });
}
