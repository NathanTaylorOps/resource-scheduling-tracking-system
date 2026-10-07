import { findEquipmentConflicts } from '@/lib/domain/equipment';
import { equipmentStatusFrom, type ComponentStatus } from '@/lib/domain/readiness';

export function evaluateEquipmentReadiness(input: {
  jobId: string;
  onSiteEquipment: Array<{ name: string; status: string }>;
  reservations: Array<{ id: string; equipmentId: string; jobId: string; start: Date; end: Date }>;
  reservedButDownForService: string[];
}): { status: ComponentStatus; reason?: string } {
  const down = input.onSiteEquipment.filter((e) => e.status === 'DOWN_FOR_SERVICE');
  const conflicts = findEquipmentConflicts(input.reservations);
  const overlap = conflicts.some((c) => c.first.jobId === input.jobId || c.second.jobId === input.jobId);
  const hasAssetConflict = overlap || input.reservedButDownForService.length > 0;
  return {
    status: equipmentStatusFrom({ hasAssetDownForService: down.length > 0, hasAssetConflict }),
    reason: down.length > 0
      ? `${down[0]!.name}${down.length > 1 ? ` and ${down.length - 1} other asset(s)` : ''} on site is down for service.`
      : hasAssetConflict ? 'A reserved asset is double-booked or down for service before it arrives.' : undefined,
  };
}
