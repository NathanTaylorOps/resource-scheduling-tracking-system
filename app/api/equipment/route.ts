import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getDb } from '@/lib/db';
import { EquipmentStatus } from '@/lib/enums';

interface CreateEquipmentBody {
  name: string;
  category: string;
  status?: string;
  acquisitionDate: string;
  inServiceDate: string;
}

const QR_PREFIX = 'CW-EQ-';
const MAX_QR_RETRIES = 1;

/** Next sequential asset tag after whatever's already on file, matching the
 * CW-EQ-0001 style every seed asset already uses. Issuing the tag here
 * rather than asking the person creating the record to type one keeps every
 * qrCode both unique (the column's own constraint) and consistent — a real
 * asset-tag number is assigned by whoever's running the yard, not invented
 * by whoever's typing the intake form. */
async function nextQrCode(): Promise<string> {
  const prisma = getDb();
  const existing = await prisma.equipment.findMany({
    where: { qrCode: { startsWith: QR_PREFIX } },
    select: { qrCode: true },
  });
  const maxNumber = existing.reduce((max, e) => {
    const match = e.qrCode.match(/^CW-EQ-(\d+)$/);
    if (!match) return max;
    return Math.max(max, parseInt(match[1], 10));
  }, 0);
  return `${QR_PREFIX}${String(maxNumber + 1).padStart(4, '0')}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function POST(request: NextRequest) {
  const prisma = getDb();
  let body: CreateEquipmentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Enter an asset name.' }, { status: 400 });
  }
  const category = body.category?.trim();
  if (!category) {
    return NextResponse.json({ error: 'Enter a category.' }, { status: 400 });
  }
  const acquisitionDate = new Date(body.acquisitionDate);
  const inServiceDate = new Date(body.inServiceDate);
  if (Number.isNaN(acquisitionDate.getTime()) || Number.isNaN(inServiceDate.getTime())) {
    return NextResponse.json({ error: 'Enter valid acquisition and in-service dates.' }, { status: 400 });
  }
  if (inServiceDate.getTime() < acquisitionDate.getTime()) {
    return NextResponse.json({ error: "In-service date can't be before the acquisition date." }, { status: 400 });
  }
  const status = body.status && Object.values(EquipmentStatus).includes(body.status as EquipmentStatus) ? body.status : EquipmentStatus.ACTIVE;

  // Computing the next tag and creating the record are two separate steps —
  // low odds of two requests racing between them in a single-user local
  // tool, but cheap to make safe rather than assumed away: on the unique-
  // constraint failure that race would cause, recompute the max (which by
  // then includes whichever request won) and try once more, rather than
  // surfacing a raw 500 for what's really a retryable scheduling accident.
  for (let attempt = 0; attempt <= MAX_QR_RETRIES; attempt++) {
    const qrCode = await nextQrCode();
    try {
      const equipment = await prisma.equipment.create({
        data: { name, category, qrCode, status, acquisitionDate, inServiceDate },
      });
      return NextResponse.json({ id: equipment.id, qrCode: equipment.qrCode }, { status: 201 });
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === MAX_QR_RETRIES) {
        throw error;
      }
    }
  }
  throw new Error('Unreachable: the retry loop above always returns or re-throws.');
}
