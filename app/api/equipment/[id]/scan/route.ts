import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { ScanAction, WorkOrderSource, WorkOrderStatus } from '@/lib/enums';
import { custodyUpdateFor } from '@/lib/domain/custody';

interface ScanRequestBody {
  action: ScanAction;
  scannedByWorkerId: string;
  jobId?: string;
  locationNote?: string;
  conditionNote?: string;
  photoDataUrl?: string;
  latitude?: number;
  longitude?: number;
}

const VALID_ACTIONS = new Set<string>(Object.values(ScanAction));

/**
 * Records one entry in an asset's chain-of-custody trail and applies the
 * resulting change to Equipment.currentJobId / currentWorkerId / status —
 * the same fields the equipment list and job detail pages read live, so a
 * scan at the tailgate is reflected everywhere the moment it's submitted.
 * The scan event itself is never edited after the fact; a correction is
 * its own new event, the same way a paper log would be corrected.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const equipment = await prisma.equipment.findFirst({
    where: { OR: [{ id: params.id }, { qrCode: params.id }] },
  });
  if (!equipment) {
    return NextResponse.json({ error: 'No equipment matches that tag.' }, { status: 404 });
  }

  let body: ScanRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!body.action || !VALID_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: 'Unrecognized scan action.' }, { status: 400 });
  }
  if (!body.scannedByWorkerId) {
    return NextResponse.json({ error: 'Select who is scanning this asset.' }, { status: 400 });
  }
  if (body.action === ScanAction.CHECK_OUT && !body.jobId) {
    return NextResponse.json({ error: 'A job is required to check equipment out.' }, { status: 400 });
  }
  if (body.action === ScanAction.LOCATION_UPDATE && !body.locationNote?.trim()) {
    return NextResponse.json({ error: 'Enter the current location.' }, { status: 400 });
  }
  if (body.action === ScanAction.DEFECT_REPORTED && !body.conditionNote?.trim()) {
    return NextResponse.json({ error: 'Describe the defect before reporting it.' }, { status: 400 });
  }

  // Every action but a check-out records the job the asset is already
  // sitting at (if any) — that's what lets custody history show a defect
  // was found at Harbor Point rather than losing that context on check-in.
  const scanJobId = body.action === ScanAction.CHECK_OUT ? body.jobId : equipment.currentJobId ?? undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const scanEvent = await tx.scanEvent.create({
        data: {
          equipmentId: equipment.id,
          scannedByWorkerId: body.scannedByWorkerId,
          jobId: scanJobId,
          action: body.action,
          conditionNote: body.conditionNote?.trim() || null,
          latitude: typeof body.latitude === 'number' ? body.latitude : null,
          longitude: typeof body.longitude === 'number' ? body.longitude : null,
        },
      });

      if (body.photoDataUrl) {
        await tx.scanPhoto.create({
          data: {
            scanEventId: scanEvent.id,
            url: body.photoDataUrl,
            caption: body.action === ScanAction.DEFECT_REPORTED ? 'Defect photo' : 'Condition photo',
          },
        });
      }

      const updatedEquipment = await tx.equipment.update({
        where: { id: equipment.id },
        // custodyUpdateFor is pure domain logic (lib/domain/custody.ts) —
        // this cast is the one place its plain field-shaped result crosses
        // into a Prisma-typed call.
        data: custodyUpdateFor(body) as Prisma.EquipmentUpdateInput,
      });

      let workOrderId: string | null = null;
      if (body.action === ScanAction.DEFECT_REPORTED) {
        const workOrder = await tx.workOrder.create({
          data: {
            equipmentId: equipment.id,
            source: WorkOrderSource.DEFECT_REPORTED,
            status: WorkOrderStatus.OPEN,
            description: body.conditionNote!.trim(),
            createdFromScanEventId: scanEvent.id,
          },
        });
        workOrderId = workOrder.id;
      }

      return { scanEventId: scanEvent.id, equipmentStatus: updatedEquipment.status, workOrderId };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The scan could not be recorded.' },
      { status: 500 },
    );
  }
}
