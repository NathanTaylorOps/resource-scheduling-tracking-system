import { getCertificationStatus } from '@/lib/domain/certifications';
import { getComplianceStatus } from '@/lib/domain/compliance';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { complianceStatusFrom, type ComponentStatus } from '@/lib/domain/readiness';
import { resolveCounterValue, resolveDueSoonWindow } from './equipment-counters';

type Equipment = {
  name: string; inServiceDate: Date;
  lifeCounters: Array<{ counterType: string; currentValue: number }>;
  compliance: Array<{ complianceType: string; counterType: string; intervalValue: number; toleranceValue: number; hardLimit: boolean; dueValue: number }>;
  maintenancePlans: Array<{ counterType: string; intervalValue: number; toleranceValue: number; hardLimit: boolean; dueValue: number }>;
};

export function evaluateComplianceReadiness(input: {
  assignments: Array<{ worker: { name: string; certifications: Array<{ certType: string; expiryDate: Date; renewalPattern: string; renewalFiledDate: Date | null }>; subcontractor: null | { businessName: string; licenseExpiryDate: Date | null; coiRecords: Array<{ coverageType: string; expiryDate: Date }> } } }>;
  equipment: Equipment[];
  now: Date;
}): { status: ComponentStatus; reason?: string } {
  let expired = false, soon = false;
  let firstExpired: string | undefined;
  for (const assignment of input.assignments) {
    for (const cert of assignment.worker.certifications) {
      const s = getCertificationStatus(cert.expiryDate, input.now, undefined, cert.renewalPattern, cert.renewalFiledDate);
      if (s.status === 'expired') { expired = true; firstExpired ??= `${assignment.worker.name}'s ${cert.certType} certification has expired.`; }
      if (s.status === 'expiring_soon' || s.status === 'aging' || s.status === 'renewal_pending') soon = true;
    }
    const sub = assignment.worker.subcontractor;
    if (sub) {
      const s = evaluateSubcontractorCompliance({ licenseExpiryDate: sub.licenseExpiryDate, coiRecords: sub.coiRecords }, input.now);
      if (s.hasExpiredItem) { expired = true; firstExpired ??= `${sub.businessName}'s insurance or license on file has expired.`; }
      if (s.hasExpiringSoonItem) soon = true;
    }
  }
  for (const item of input.equipment) {
    for (const c of item.compliance) {
      const value = resolveCounterValue(c.counterType, item, input.now);
      if (value === null) continue;
      const s = getComplianceStatus({ unit: c.counterType, intervalValue: c.intervalValue, toleranceValue: c.toleranceValue, hardLimit: c.hardLimit, dueValue: c.dueValue }, value, resolveDueSoonWindow(c.counterType));
      if (s.status === 'overdue') { expired = true; firstExpired ??= `${item.name}'s ${c.complianceType.toLowerCase()} is overdue.`; }
      if (s.status === 'due_soon' || s.status === 'in_tolerance') soon = true;
    }
    for (const plan of item.maintenancePlans) {
      const value = resolveCounterValue(plan.counterType, item, input.now);
      if (value === null) continue;
      const s = getComplianceStatus({ unit: plan.counterType, intervalValue: plan.intervalValue, toleranceValue: plan.toleranceValue, hardLimit: plan.hardLimit, dueValue: plan.dueValue }, value, resolveDueSoonWindow(plan.counterType));
      if (s.status === 'overdue') { expired = true; firstExpired ??= `${item.name} is overdue for scheduled maintenance.`; }
      if (s.status === 'due_soon' || s.status === 'in_tolerance') soon = true;
    }
  }
  return {
    status: complianceStatusFrom({ hasExpiredItem: expired, hasExpiringSoonItem: soon }),
    reason: expired ? firstExpired : soon ? 'A certification, subcontractor compliance item, or equipment compliance item needs review soon.' : undefined,
  };
}
