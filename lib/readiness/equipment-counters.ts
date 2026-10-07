import type { MaintenancePlan as DomainMaintenancePlan } from '@/lib/domain/maintenance';

export const DUE_SOON_WINDOW_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;

const DUE_SOON_WINDOW_BY_COUNTER: Record<string, number> = {
  CALENDAR_DAYS: DUE_SOON_WINDOW_DAYS,
  RUN_HOURS: 20,
  CYCLES: 10,
};

export function resolveDueSoonWindow(counterType: string): number {
  return DUE_SOON_WINDOW_BY_COUNTER[counterType] ?? DUE_SOON_WINDOW_DAYS;
}

export function resolveCounterValue(
  counterType: string,
  equipment: { inServiceDate: Date; lifeCounters: Array<{ counterType: string; currentValue: number }> },
  now: Date,
): number | null {
  if (counterType === 'CALENDAR_DAYS') {
    return Math.floor((now.getTime() - equipment.inServiceDate.getTime()) / DAY_MS);
  }
  const counter = equipment.lifeCounters.find((lc) => lc.counterType === counterType);
  return counter ? counter.currentValue : null;
}

export function toDomainPlan(plan: {
  id: string; equipmentId: string; parentPlanId: string | null; counterType: string;
  intervalValue: number; toleranceValue: number; hardLimit: boolean; dueValue: number;
}): DomainMaintenancePlan {
  return {
    id: plan.id,
    equipmentId: plan.equipmentId,
    parentPlanId: plan.parentPlanId,
    schedule: {
      unit: plan.counterType, intervalValue: plan.intervalValue, toleranceValue: plan.toleranceValue,
      hardLimit: plan.hardLimit, dueValue: plan.dueValue,
    },
  };
}
