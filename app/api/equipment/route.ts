import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EquipmentStatus } from '@/lib/enums';

interface CreateEquipmentBody {
  name: string;
  category: string;
  status?: string;
  acquisitionDate: string;
  inServiceDate: string;
}

const QR_PREFIX = 'CW-EQ-';

/** Next sequential asset tag after whatever's already on file, matching the
 * CW-EQ-0001 style every seed asset already uses. Issuing the tag here
 * rather than asking the person creating the record to type one keeps every
 * qrCode both unique (the column's own constraint) and consistent — a real
 * asset-tag number is assigned by whoever's running the yard, not invented
 * by whoever's typing the intake form. */
async function nextQrCode(): Promise<string> {
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

export async function POST(request: NextRequest) {
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
  const status = body.status && Object.values(EquipmentStatus).includes(body.status as EquipmentStatus) ? body.status : EquipmentStatus.ACTIVE;

  const qrCode = await nextQrCode();
  const equipment = await prisma.equipment.create({
    data: { name, category, qrCode, status, acquisitionDate, inServiceDate },
  });

  return NextResponse.json({ id: equipment.id, qrCode: equipment.qrCode }, { status: 201 });
}
