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
  /**
   * The asset's status *before* this scan is applied. Required so
   * custodyUpdateFor can refuse a CHECK_OUT of an asset that's currently
   * down for service — the caller (app/api/equipment/[id]/scan/route.ts)
   * must read this from the same transaction that will apply the update,
   * not from a snapshot taken before the transaction opened.
   */
  currentStatus: string;
}

export interface EquipmentCustodyUpdate {
  currentJobId?: string | null;
  currentWorkerId?: string | null;
  locationNote?: string | null;
  status?: string;
}

/**
 * Thrown when a requested action is not valid given the asset's current
 * status — e.g. checking out an asset that's down for service. The route
 * catches this and returns 409, distinct from a validation 400 or a 500.
 */
export class CustodyActionRejected extends Error {}

export function custodyUpdateFor(input: ScanCustodyInput): EquipmentCustodyUpdate {
  switch (input.action) {
    case 'CHECK_OUT':
      // An asset with an open defect (status DOWN_FOR_SERVICE) cannot be
      // checked out to a job — that would silently un-flag a known-broken
      // asset as available the moment someone scans it, with the work
      // order left open and now invisible everywhere that reads
      // Equipment.status instead of querying WorkOrder directly. The
      // defect has to be resolved (which flips status back via the
      // work-order-complete route) before the asset can move again.
      if (input.currentStatus === 'DOWN_FOR_SERVICE') {
        throw new CustodyActionRejected(
          'This asset is down for service with an open work order and cannot be checked out until that work order is completed.',
        );
      }
      if (input.currentStatus === 'RETIRED') {
        throw new CustodyActionRejected('This asset is retired and cannot be checked out.');
      }
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
