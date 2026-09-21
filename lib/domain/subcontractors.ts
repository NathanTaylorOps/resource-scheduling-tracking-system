/**
 * Subcontractor entity-level compliance — a certificate of insurance and a
 * trade license, held by the business rather than by whichever of its
 * workers happens to be on site today.
 *
 * The status math is identical to a HARD_EXPIRY worker certification — a
 * license or a COI coverage line either has a real expiry date or it
 * doesn't — so this module reuses getCertificationStatus directly rather
 * than duplicating the date arithmetic. That's a deliberate departure from
 * equipment.ts's findEquipmentConflicts, which duplicates findOverlaps's
 * algorithm on purpose because a worker double-booking and an equipment
 * double-booking are genuinely different situations to a superintendent
 * even though the interval math matches. Here the underlying concept really
 * is the same one — "does this credential remain valid, with tiered
 * warning thresholds" — just held by a firm instead of a person, so reuse
 * is the more honest choice.
 */

import { getCertificationStatus, type CertificationStatus } from './certifications';

export interface SubcontractorCredential {
  /** e.g. "Trade license" or "General liability" — what to call this line if it needs attention. */
  label: string;
  status: CertificationStatus;
}

export interface SubcontractorComplianceInputs {
  licenseExpiryDate: Date | null;
  coiRecords: Array<{ coverageType: string; expiryDate: Date }>;
}

/**
 * Evaluates every credential a subcontractor firm needs to remain eligible
 * to work — its trade license (if tracked) and every COI coverage line —
 * and returns each one's status alongside the aggregate signal the
 * readiness compliance component needs. A firm with no license on file and
 * no COI records isn't flagged as a gap by this function alone — that's a
 * data-completeness question for the UI to surface, not a compliance
 * failure to assert.
 */
export function evaluateSubcontractorCompliance(
  inputs: SubcontractorComplianceInputs,
  now: Date,
): { credentials: SubcontractorCredential[]; hasExpiredItem: boolean; hasExpiringSoonItem: boolean } {
  const credentials: SubcontractorCredential[] = [];

  if (inputs.licenseExpiryDate) {
    credentials.push({
      label: 'Trade license',
      status: getCertificationStatus(inputs.licenseExpiryDate, now, undefined, 'LICENSE_CYCLE').status,
    });
  }

  for (const coi of inputs.coiRecords) {
    credentials.push({
      label: coi.coverageType,
      status: getCertificationStatus(coi.expiryDate, now, undefined, 'HARD_EXPIRY').status,
    });
  }

  return {
    credentials,
    hasExpiredItem: credentials.some((c) => c.status === 'expired'),
    hasExpiringSoonItem: credentials.some(
      (c) => c.status === 'expiring_soon' || c.status === 'aging' || c.status === 'renewal_pending',
    ),
  };
}
