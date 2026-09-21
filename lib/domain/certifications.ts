/**
 * Worker certification status and assignment gating.
 *
 * Status is always derived from date math against the current time, never
 * stored — the same principle used for compliance status elsewhere in this
 * module. Recert alerting follows the tiered-window convention used
 * throughout the industry (90/60/30 days, then overdue) rather than a single
 * flat reminder.
 *
 * A single expiryDate field can't honestly carry every real renewal shape a
 * certification follows, so status is also a function of renewalPattern
 * (full rationale on WorkerCertification.renewalPattern in schema.prisma):
 *   - HARD_EXPIRY and LICENSE_CYCLE both use expiryDate as a real wall — the
 *     same math as before this field existed, which is why both are also
 *     the default when no pattern is given.
 *   - INFORMAL_RECENCY treats expiryDate as an informal recommended-refresh
 *     date rather than a hard wall — a card that's aged past it is a real
 *     gap, but not the same kind of stop an actually-expired credential is,
 *     so it reads as 'aging' rather than 'expired'.
 *   - GRACE_PERIOD allows a renewal filed on time (at least
 *     GRACE_FILING_WINDOW_DAYS before expiryDate) to keep the certification
 *     valid past its nominal expiry while the renewal is pending — a
 *     three-state condition (valid / expired / renewal_pending), not a
 *     binary.
 */

export type CertificationStatus = 'valid' | 'expiring_soon' | 'expired' | 'aging' | 'renewal_pending';

// renewalPattern is a plain string here, not a literal union — the same
// choice compliance.ts makes for counterType/complianceType. It's a stored
// SQLite column (see lib/enums.ts's RenewalPattern for the authoring-time
// value/type pair the rest of the app uses), and this module only ever
// compares it against a handful of known literals, so there's nothing a
// stricter parameter type would buy beyond what lib/enums.ts already gives
// callers. CertificationStatus, by contrast, is a literal union because
// it's computed entirely by this module, never round-tripped from storage.
export interface Certification {
  certType: string;
  expiryDate: Date;
  renewalPattern?: string;
  renewalFiledDate?: Date | null;
}

const DEFAULT_THRESHOLDS = [90, 60, 30];

/** EPA RRP's own rule: recertification filed at least this many days before
 * expiry keeps the existing certification valid while the renewal is
 * decided. Used as the general GRACE_PERIOD rule here rather than a
 * per-certification-type constant, since it's the only researched example
 * of this pattern. */
const GRACE_FILING_WINDOW_DAYS = 90;

/** Reference figure only — getCertificationStatus takes whatever expiryDate
 * it's given on an INFORMAL_RECENCY row and never consults this constant
 * itself, since that date already IS the recommended-refresh-by date, however
 * it was set. This exists for whoever sets that date (an HR policy, or this
 * app's own seed data): the industry's informal expectation for cards that
 * never formally expire (OSHA 10/30) is "refreshed within the last three to
 * five years," and three years is the earlier, more conservative edge of
 * that range — a worker reads as 'aging' as soon as it's plausible a
 * reviewer would ask about it, not only once every observer would agree
 * it's overdue. */
export const INFORMAL_RECENCY_WINDOW_DAYS = 3 * 365;

export interface CertificationStatusResult {
  status: CertificationStatus;
  daysUntilExpiry: number;
  /** The soonest alerting threshold this certification has crossed, if any. */
  crossedThreshold: number | null;
}

export function getCertificationStatus(
  expiryDate: Date,
  now: Date,
  thresholds: number[] = DEFAULT_THRESHOLDS,
  renewalPattern: string = 'HARD_EXPIRY',
  renewalFiledDate?: Date | null,
): CertificationStatusResult {
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    if (renewalPattern === 'INFORMAL_RECENCY') {
      // Never a hard wall — no card was actually invalidated. This is a
      // documentation gap worth flagging, not a "this worker can't legally
      // do this work today" stop.
      return { status: 'aging', daysUntilExpiry, crossedThreshold: 0 };
    }

    if (renewalPattern === 'GRACE_PERIOD') {
      const filingDeadline = expiryDate.getTime() - GRACE_FILING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const filedOnTime = renewalFiledDate != null && renewalFiledDate.getTime() <= filingDeadline;
      if (filedOnTime) {
        return { status: 'renewal_pending', daysUntilExpiry, crossedThreshold: 0 };
      }
    }

    return { status: 'expired', daysUntilExpiry, crossedThreshold: 0 };
  }

  // Ascending, so the FIRST threshold this still satisfies is the tightest
  // (most urgent) tier already crossed — e.g. 15 days out has crossed the
  // 90- and 60-day tiers too, but 30 is the one that matters for the alert.
  const sortedThresholds = [...thresholds].sort((a, b) => a - b);
  const crossedThreshold = sortedThresholds.find((t) => daysUntilExpiry <= t) ?? null;

  return {
    status: crossedThreshold !== null ? 'expiring_soon' : 'valid',
    daysUntilExpiry,
    crossedThreshold,
  };
}

export interface AssignmentEligibility {
  eligible: boolean;
  missingOrExpired: string[];
}

/**
 * Checks whether a worker holds every certification a task requires, all
 * currently valid. This is the gate that links crew scheduling to
 * certification tracking: a scheduler should refuse — or hard-warn on — an
 * assignment that fails this check, rather than leaving certification status
 * as a separate tab nobody checks before the job starts.
 *
 * Only a true 'expired' status blocks an assignment. 'aging' (an
 * INFORMAL_RECENCY card past its informal refresh window) and
 * 'renewal_pending' (a GRACE_PERIOD renewal filed on time) both mean the
 * worker still legally holds the credential — worth a PM's attention, not a
 * hard stop.
 */
export function canAssignWorker(
  requiredCertTypes: string[],
  workerCertifications: Certification[],
  now: Date,
): AssignmentEligibility {
  const missingOrExpired: string[] = [];

  for (const required of requiredCertTypes) {
    const heldRecords = workerCertifications.filter((c) => c.certType === required);
    if (heldRecords.length === 0) {
      missingOrExpired.push(required);
      continue;
    }

    // A worker can have more than one record for the same certType — a
    // renewal filed alongside the card it replaces, say. Picking just the
    // first match (by whatever order the records happen to arrive in) would
    // make eligibility depend on array order rather than on whether the
    // worker actually currently holds the credential: they hold it if ANY
    // on-file record for this type isn't expired, not only if the first one
    // isn't.
    const allExpired = heldRecords.every(
      (held) =>
        getCertificationStatus(held.expiryDate, now, undefined, held.renewalPattern, held.renewalFiledDate).status ===
        'expired',
    );
    if (allExpired) {
      missingOrExpired.push(required);
    }
  }

  return { eligible: missingOrExpired.length === 0, missingOrExpired };
}
