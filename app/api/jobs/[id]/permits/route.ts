import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PermitType, PermitStatus } from '@/lib/enums';

interface CreatePermitBody {
  permitType: string;
  issuingAuthority: string;
  permitNumber?: string;
  appliedDate: string;
}

const VALID_PERMIT_TYPES = new Set<string>(Object.values(PermitType));

/**
 * Files a new permit against a job, status APPLIED — the same starting
 * point every seeded permit uses. Its inspection sequence isn't generated
 * here: there's no canonical footing-through-final sequence modeled
 * anywhere in this codebase to generate it from (see AddInspectionForm),
 * so inspections get added one at a time as they're actually scheduled,
 * rather than this route guessing at a sequence that might not match how a
 * real jurisdiction orders them.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreatePermitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.permitType || !VALID_PERMIT_TYPES.has(body.permitType)) {
    return NextResponse.json({ error: 'Select a permit type.' }, { status: 400 });
  }
  const issuingAuthority = body.issuingAuthority?.trim();
  if (!issuingAuthority) {
    return NextResponse.json({ error: 'Enter the issuing authority.' }, { status: 400 });
  }
  const appliedDate = new Date(body.appliedDate);
  if (Number.isNaN(appliedDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid applied date.' }, { status: 400 });
  }

  const permit = await prisma.permit.create({
    data: {
      jobId: job.id,
      permitType: body.permitType,
      issuingAuthority,
      permitNumber: body.permitNumber?.trim() || null,
      appliedDate,
      status: PermitStatus.APPLIED,
    },
  });

  return NextResponse.json({ id: permit.id }, { status: 201 });
}
