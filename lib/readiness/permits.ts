import { permitsStatusFrom, type ComponentStatus } from '@/lib/domain/readiness';
import { isPastCalendarDate } from '@/lib/domain/dates';
import { DAY_MS, DUE_SOON_WINDOW_DAYS } from './equipment-counters';

export function evaluatePermitReadiness(input: {
  permits: Array<{ permitType: string; status: string; expiryDate: Date | null; inspections: Array<{ status: string; scheduledDate: Date | null }> }>;
  now: Date;
}): { status: ComponentStatus; reason?: string } {
  const expired = input.permits.filter((p) => p.status === 'EXPIRED' || (p.expiryDate !== null && isPastCalendarDate(p.expiryDate, input.now)));
  const inspections = input.permits.flatMap((p) => p.inspections);
  const failed = inspections.some((i) => i.status === 'FAILED');
  const overdue = inspections.some((i) => i.status === 'SCHEDULED' && i.scheduledDate !== null && i.scheduledDate.getTime() < input.now.getTime());
  const dueSoon = inspections.some((i) => i.status === 'SCHEDULED' && i.scheduledDate !== null && i.scheduledDate.getTime() >= input.now.getTime() && i.scheduledDate.getTime() - input.now.getTime() <= DUE_SOON_WINDOW_DAYS * DAY_MS);
  const failedPermit = input.permits.find((p) => p.inspections.some((i) => i.status === 'FAILED'));
  const overduePermit = input.permits.find((p) => p.inspections.some((i) => i.status === 'SCHEDULED' && i.scheduledDate !== null && i.scheduledDate.getTime() < input.now.getTime()));
  return {
    status: permitsStatusFrom({ hasFailedInspection: failed, hasExpiredPermit: expired.length > 0, hasOverdueInspection: overdue, hasInspectionDueSoon: dueSoon }),
    reason: failed ? `The ${failedPermit!.permitType.toLowerCase()} permit has a failed inspection.`
      : expired.length ? `The ${expired[0]!.permitType.toLowerCase()} permit has expired.`
      : overdue ? `The ${overduePermit!.permitType.toLowerCase()} permit has an overdue inspection with no recorded result.`
      : dueSoon ? 'An inspection is coming up in the next two weeks.' : undefined,
  };
}
