/**
 * Worker certification status and assignment gating.
 *
 * Status is always derived from date math against the current time, never
 * stored — the same principle used for compliance status elsewhere in this
 * module. Recert alerting follows the tiered-window convention used
 * throughout the industry (90/60/30 days, then overdue) rather than a single
 * flat reminder.
 */

export type CertificationStatus = 'valid' | 'expiring_soon' | 'expired';

export interface Certification {
  certType: string;
  expiryDate: Date;
}

const DEFAULT_THRESHOLDS = [90, 60, 30];

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
): CertificationStatusResult {
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
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
 */
export function canAssignWorker(
  requiredCertTypes: string[],
  workerCertifications: Certification[],
  now: Date,
): AssignmentEligibility {
  const missingOrExpired: string[] = [];

  for (const required of requiredCertTypes) {
    const held = workerCertifications.find((c) => c.certType === required);
    if (!held) {
      missingOrExpired.push(required);
      continue;
    }
    const { status } = getCertificationStatus(held.expiryDate, now);
    if (status === 'expired') {
      missingOrExpired.push(required);
    }
  }

  return { eligible: missingOrExpired.length === 0, missingOrExpired };
}
