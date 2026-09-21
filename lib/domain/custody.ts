/**
 * What a scan action does to an asset's custody and status fields.
 *
 * This is deliberately just the decision — "given this action, what changes
 * on the Equipment row" — with no database access of its own. The actual
 * write, plus the side effects a real scan has (an append-only ScanEvent,
 * and a WorkOrder opened when the action is a defect report) live at the
 * call site, app/api/equipment/[id]/scan/route.ts. Keeping the rule itself
 * here means the four cases below — check-out, check-in, a location update,
 * a defect report — are provable on their own, the same way every other
 * rule in lib/domain is.
 */

export type ScanCustodyAction = 'CHECK_OUT' | 'CHECK_IN' | 'LOCATION_UPDATE' | 'DEFECT_REPORTED';

export interface ScanCustodyInput {
  action: ScanCustodyAction;
  scannedByWorkerId: string;
  jobId?: string;
  locationNote?: string;
}

export interface EquipmentCustodyUpdate {
  currentJobId?: string | null;
  currentWorkerId?: string | null;
  locationNote?: string | null;
  status?: string;
}

export function custodyUpdateFor(input: ScanCustodyInput): EquipmentCustodyUpdate {
  switch (input.action) {
    case 'CHECK_OUT':
      // Custody follows the crew member who scanned it out, not just the
      // job — that's the difference between "somewhere at Harbor Point" and
      // "signed for by Marcus" when a GM goes looking for an asset.
      return {
        currentJobId: input.jobId,
        currentWorkerId: input.scannedByWorkerId,
        locationNote: null,
        status: 'ACTIVE',
      };
    case 'CHECK_IN':
      return {
        currentJobId: null,
        currentWorkerId: null,
        locationNote: input.locationNote?.trim() || 'Yard',
        status: 'IDLE',
      };
    case 'LOCATION_UPDATE':
      return { locationNote: input.locationNote?.trim() };
    case 'DEFECT_REPORTED':
      // Deliberately leaves currentJobId/currentWorkerId untouched — the
      // asset hasn't moved, it's just been flagged where it sits.
      return { status: 'DOWN_FOR_SERVICE' };
    default:
      return {};
  }
}
