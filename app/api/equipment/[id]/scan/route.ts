import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { ScanAction, WorkOrderSource, WorkOrderStatus } from '@/lib/enums';
import { custodyUpdateFor, CustodyActionRejected } from '@/lib/domain/custody';
import { apiError } from '@/lib/api';
import {
  parseJsonBody,
  requiredString,
  optionalString,
  requiredEnum,
  optionalCoordinates,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/validate';

// A generous ceiling for a phone-camera photo re-encoded as a data URL
// (roughly 6.5MB of actual image bytes once the ~33% base64 overhead is
// backed out) — enough for a real defect photo, not so much that one
// visitor's session database can be bloated by an unbounded upload. There
// is no separate file-storage layer here (see lib/db.ts's per-visitor
// SQLite design), so this string lands directly in that visitor's own
// database file.
const MAX_PHOTO_DATA_URL_LENGTH = 9_000_000;

const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_DATA_URL_PATTERN = new RegExp(
  `^data:(${ALLOWED_PHOTO_MIME_TYPES.map((t) => t.replace('/', '\\/')).join('|')});base64,[A-Za-z0-9+/]+=*$`,
);

function validatePhotoDataUrl(value: string): void {
  if (value.length > MAX_PHOTO_DATA_URL_LENGTH) {
    throw new ValidationError('That photo is too large — try a lower-resolution photo.');
  }
  if (!PHOTO_DATA_URL_PATTERN.test(value)) {
    throw new ValidationError('That file does not look like a supported photo (JPEG, PNG, WebP, or HEIC).');
  }
}

/**
 * Records one entry in an asset's chain-of-custody trail and applies the
 * resulting change to Equipment.currentJobId / currentWorkerId / status —
 * the same fields the equipment list and job detail pages read live, so a
 * scan at the tailgate is reflected everywhere the moment it's submitted.
 * The scan event itself is never edited after the fact; a correction is
 * its own new event, the same way a paper log would be corrected.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    // Only used to resolve the id-or-QR-code lookup and return a fast 404
    // before parsing the body. The transaction below re-reads the row by
    // its resolved id, so two scans racing on the same asset each get a
    // fresh read inside their own transaction.
    const equipmentLookup = await prisma.equipment.findFirst({
      where: { OR: [{ id: params.id }, { qrCode: params.id }] },
      select: { id: true },
    });
    if (!equipmentLookup) {
      throw new NotFoundError('No equipment matches that tag.');
    }

    const body = await parseJsonBody(request);
    const action = requiredEnum(body, 'action', ScanAction, 'Unrecognized scan action.');
    const scannedByWorkerId = requiredString(body, 'scannedByWorkerId', 'Select who is scanning this asset.');
    const jobId = optionalString(body, 'jobId');
    const locationNote = optionalString(body, 'locationNote');
    const conditionNote = optionalString(body, 'conditionNote');
    const photoDataUrl = optionalString(body, 'photoDataUrl');
    const { latitude, longitude } = optionalCoordinates(body);

    if (action === ScanAction.CHECK_OUT && !jobId) {
      throw new ValidationError('A job is required to check equipment out.');
    }
    if (action === ScanAction.LOCATION_UPDATE && !locationNote) {
      throw new ValidationError('Enter the current location.');
    }
    if (action === ScanAction.DEFECT_REPORTED && !conditionNote) {
      throw new ValidationError('Describe the defect before reporting it.');
    }
    if (photoDataUrl) {
      validatePhotoDataUrl(photoDataUrl);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Read the row this transaction will act on fresh, inside the
        // transaction — this is what prevents two concurrent scans (a
        // CHECK_OUT and a LOCATION_UPDATE fired back-to-back from two
        // devices) from both acting on the same stale snapshot.
        const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: equipmentLookup.id } });

        const worker = await tx.worker.findUnique({ where: { id: scannedByWorkerId }, select: { id: true } });
        if (!worker) {
          throw new ValidationError('The selected worker no longer exists.');
        }
        if (jobId) {
          const job = await tx.job.findUnique({ where: { id: jobId }, select: { id: true } });
          if (!job) {
            throw new ValidationError('The selected job no longer exists.');
          }
        }

        // Every action but a check-out records the job the asset is already
        // sitting at (if any) — that's what lets custody history show a
        // defect was found at Harbor Point rather than losing that context
        // on check-in.
        const scanJobId = action === ScanAction.CHECK_OUT ? jobId! : equipment.currentJobId ?? undefined;

        const scanEvent = await tx.scanEvent.create({
          data: {
            equipmentId: equipment.id,
            scannedByWorkerId,
            jobId: scanJobId,
            action,
            conditionNote,
            latitude,
            longitude,
          },
        });

        if (photoDataUrl) {
          await tx.scanPhoto.create({
            data: {
              scanEventId: scanEvent.id,
              url: photoDataUrl,
              caption: action === ScanAction.DEFECT_REPORTED ? 'Defect photo' : 'Condition photo',
            },
          });
        }

        // custodyUpdateFor is pure domain logic (lib/domain/custody.ts) and
        // throws CustodyActionRejected if the action isn't valid given the
        // asset's current status (e.g. checking out an asset that's down
        // for service) — mapped to a 409 below.
        const custodyUpdate = custodyUpdateFor({
          action,
          scannedByWorkerId,
          jobId: jobId ?? undefined,
          locationNote: locationNote ?? undefined,
          currentStatus: equipment.status,
        });

        const updatedEquipment = await tx.equipment.update({
          where: { id: equipment.id },
          // The one place custodyUpdateFor's plain field-shaped result
          // crosses into a Prisma-typed call.
          data: custodyUpdate as Prisma.EquipmentUpdateInput,
        });

        let workOrderId: string | null = null;
        if (action === ScanAction.DEFECT_REPORTED) {
          const workOrder = await tx.workOrder.create({
            data: {
              equipmentId: equipment.id,
              source: WorkOrderSource.DEFECT_REPORTED,
              status: WorkOrderStatus.OPEN,
              description: conditionNote!,
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
        throw new ConflictError(err.message);
      }
      throw err;
    }
  } catch (err) {
    return apiError(err);
  }
}
