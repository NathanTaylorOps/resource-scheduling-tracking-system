import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RenewalPattern } from '@/lib/enums';

interface CreateCertificationBody {
  certType: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  renewalPattern?: string;
  renewalFiledDate?: string;
}

const VALID_RENEWAL_PATTERNS = new Set<string>(Object.values(RenewalPattern));

/**
 * Adds a certification record to a worker's personal file. Outside Prisma
 * Studio, this is the only way a worker created after seeding can ever hold
 * a certification at all — without it, canAssignWorker's hard stop (see
 * app/api/jobs/[id]/assignments) was correct code with nothing to check for
 * anyone who wasn't already in the seed data, since it reads certifications
 * this route is what writes.
 *
 * renewalFiledDate only means anything for a GRACE_PERIOD certification
 * (see WorkerCertification.renewalPattern's own comment in schema.prisma —
 * it's the one pattern where a renewal filed before expiry keeps the old
 * certification valid while it's pending) and is ignored for any other
 * pattern rather than rejected, so a stray value left over from switching
 * the renewal-pattern select doesn't block an otherwise-valid save.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const worker = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!worker) {
    return NextResponse.json({ error: 'No worker matches that id.' }, { status: 404 });
  }

  let body: CreateCertificationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const certType = body.certType?.trim();
  if (!certType) {
    return NextResponse.json({ error: 'Enter the certification type.' }, { status: 400 });
  }
  const issuingBody = body.issuingBody?.trim();
  if (!issuingBody) {
    return NextResponse.json({ error: 'Enter the issuing body.' }, { status: 400 });
  }
  const issueDate = new Date(body.issueDate);
  const expiryDate = new Date(body.expiryDate);
  if (Number.isNaN(issueDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
    return NextResponse.json({ error: 'Enter valid issue and expiry dates.' }, { status: 400 });
  }
  if (expiryDate.getTime() <= issueDate.getTime()) {
    return NextResponse.json({ error: 'Expiry date must be after the issue date.' }, { status: 400 });
  }
  const renewalPattern =
    body.renewalPattern && VALID_RENEWAL_PATTERNS.has(body.renewalPattern) ? body.renewalPattern : RenewalPattern.HARD_EXPIRY;

  let renewalFiledDate: Date | null = null;
  if (renewalPattern === RenewalPattern.GRACE_PERIOD && body.renewalFiledDate) {
    renewalFiledDate = new Date(body.renewalFiledDate);
    if (Number.isNaN(renewalFiledDate.getTime())) {
      return NextResponse.json({ error: 'Enter a valid renewal-filed date.' }, { status: 400 });
    }
  }

  const certification = await prisma.workerCertification.create({
    data: {
      workerId: worker.id,
      certType,
      issuingBody,
      issueDate,
      expiryDate,
      renewalPattern,
      renewalFiledDate,
    },
  });

  return NextResponse.json({ id: certification.id }, { status: 201 });
}
