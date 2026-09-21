import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { ScanAction, WorkOrderSource, WorkOrderStatus } from '@/lib/enums';
import { custodyUpdateFor, CustodyActionRejected } from '@/lib/domain/custody';

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
  // Only used to resolve the id-or-QR-code lookup and return a fast 404
  // before parsing the body. The transaction below re-reads the row by its
  // resolved id, so nothing about custody or status is decided from this
  // snapshot — two scans racing on the same asset each get a fresh read
  // inside their own transaction rather than both acting on data that may
  // already be stale by the time either transaction opens.
  const equipmentLookup = await prisma.equipment.findFirst({
    where: { OR: [{ id: params.id }, { qrCode: params.id }] },
    select: { id: true },
  });
  if (!equipmentLookup) {
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Read the row this transaction will act on fresh, inside the
      // transaction, not from the pre-body-parse lookup above. This is
      // what actually prevents two concurrent scans (e.g. a CHECK_OUT and
      // a LOCATION_UPDATE fired back-to-back from two devices) from both
      // computing scanJobId/status changes off the same stale snapshot —
      // each transaction sees whatever the other has already committed.
      const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: equipmentLookup.id } });

      if (body.scannedByWorkerId) {
        const worker = await tx.worker.findUnique({ where: { id: body.scannedByWorkerId }, select: { id: true } });
        if (!worker) {
          throw new ScanValidationError('The selected worker no longer exists.');
        }
      }
      if (body.jobId) {
        const job = await tx.job.findUnique({ where: { id: body.jobId }, select: { id: true } });
        if (!job) {
          throw new ScanValidationError('The selected job no longer exists.');
        }
      }

      // Every action but a check-out records the job the asset is already
      // sitting at (if any) — that's what lets custody history show a
      // defect was found at Harbor Point rather than losing that context
      // on check-in. Derived from the fresh in-transaction read, not the
      // pre-transaction lookup.
      const scanJobId = body.action === ScanAction.CHECK_OUT ? body.jobId : equipment.currentJobId ?? undefined;

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

      // custodyUpdateFor is pure domain logic (lib/domain/custody.ts) and
      // throws CustodyActionRejected if the action isn't valid given the
      // asset's current status (e.g. checking out an asset that's down
      // for service) — caught below and returned as a 409, not a 500.
      const custodyUpdate = custodyUpdateFor({
        action: body.action,
        scannedByWorkerId: body.scannedByWorkerId,
        jobId: body.jobId,
        locationNote: body.locationNote,
        currentStatus: equipment.status,
      });

      const updatedEquipment = await tx.equipment.update({
        where: { id: equipment.id },
        // This cast is the one place custodyUpdateFor's plain
        // field-shaped result crosses into a Prisma-typed call.
        data: custodyUpdate as Prisma.EquipmentUpdateInput,
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
    if (err instanceof CustodyActionRejected) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ScanValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'The scan could not be recorded.' }, { status: 500 });
  }
}

class ScanValidationError extends Error {}
