import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WorkOrderStatus, WorkOrderSource, EquipmentStatus } from '@/lib/enums';
import { applyCompletionToHierarchy, type MaintenancePlan as DomainMaintenancePlan } from '@/lib/domain/maintenance';
import { resolveCounterValue } from '@/lib/readiness-service';

interface CompleteWorkOrderBody {
  completedAtValue?: number;
  notes?: string;
}

/**
 * Marks a work order complete. When it's tied to a preventive-maintenance
 * plan, this is also where the fixed-grid schedule actually advances —
 * dueValue + intervalValue, per lib/domain/compliance.ts — and where a
 * nested child plan the same service covers gets suppressed for this cycle
 * instead of generating a duplicate line item, per lib/domain/maintenance.ts.
 * A defect-sourced work order with no plan behind it just closes out, and
 * if it was the last thing keeping the asset down, clears DOWN_FOR_SERVICE.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const workOrder = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found.' }, { status: 404 });
  }
  if (workOrder.status === WorkOrderStatus.COMPLETED) {
    return NextResponse.json({ error: 'This work order is already completed.' }, { status: 400 });
  }

  let body: CompleteWorkOrderBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let completedAtValue: number | null = body.completedAtValue ?? null;
      const advancedPlans: Array<{ planId: string; dueValue: number }> = [];

      if (workOrder.maintenancePlanId) {
        const equipment = await tx.equipment.findUniqueOrThrow({
          where: { id: workOrder.equipmentId },
          include: { lifeCounters: true, maintenancePlans: true },
        });
        const plan = equipment.maintenancePlans.find((p) => p.id === workOrder.maintenancePlanId);
        if (!plan) {
          throw new Error('The maintenance plan behind this work order no longer exists.');
        }

        if (completedAtValue === null) {
          completedAtValue = resolveCounterValue(plan.counterType, equipment, now);
        }
        if (completedAtValue === null) {
          throw new Error('No reading is on file for this asset — enter the counter value at completion.');
        }

        const domainPlan = toDomainPlan(plan);
        const allDomainPlans = equipment.maintenancePlans.map(toDomainPlan);
        const hierarchyResult = applyCompletionToHierarchy(domainPlan, allDomainPlans, completedAtValue);

        await tx.maintenancePlan.update({
          where: { id: hierarchyResult.parentPlanId },
          data: { dueValue: hierarchyResult.updatedParent.dueValue },
        });
        advancedPlans.push({ planId: hierarchyResult.parentPlanId, dueValue: hierarchyResult.updatedParent.dueValue });

        for (const child of hierarchyResult.suppressedChildren) {
          await tx.maintenancePlan.update({
            where: { id: child.planId },
            data: { dueValue: child.updatedSchedule.dueValue },
          });
          advancedPlans.push({ planId: child.planId, dueValue: child.updatedSchedule.dueValue });

          // A child plan that had already picked up its own separate work
          // order before the parent came due shouldn't linger on the board
          // once the parent's service covers it — this cycle is done.
          await tx.workOrder.updateMany({
            where: {
              maintenancePlanId: child.planId,
              status: { not: WorkOrderStatus.COMPLETED },
              id: { not: workOrder.id },
            },
            data: { status: WorkOrderStatus.COMPLETED, completedAt: now, completedAtValue },
          });
        }
      }

      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          status: WorkOrderStatus.COMPLETED,
          completedAt: now,
          completedAtValue: completedAtValue ?? undefined,
          description: body.notes?.trim()
            ? `${workOrder.description} — Completed: ${body.notes.trim()}`
            : workOrder.description,
        },
      });

      // A defect took the asset out of service; clearing it back to idle is
      // only safe once nothing else open is still holding it down.
      if (workOrder.source === WorkOrderSource.DEFECT_REPORTED) {
        const remainingOpen = await tx.workOrder.count({
          where: { equipmentId: workOrder.equipmentId, status: { not: WorkOrderStatus.COMPLETED } },
        });
        if (remainingOpen === 0) {
          await tx.equipment.update({ where: { id: workOrder.equipmentId }, data: { status: EquipmentStatus.IDLE } });
        }
      }

      return { workOrderId: updatedWorkOrder.id, advancedPlans };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The work order could not be completed.' },
      { status: 400 },
    );
  }
}

function toDomainPlan(plan: {
  id: string;
  equipmentId: string;
  parentPlanId: string | null;
  counterType: string;
  intervalValue: number;
  toleranceValue: number;
  hardLimit: boolean;
  dueValue: number;
}): DomainMaintenancePlan {
  return {
    id: plan.id,
    equipmentId: plan.equipmentId,
    parentPlanId: plan.parentPlanId,
    schedule: {
      unit: plan.counterType,
      intervalValue: plan.intervalValue,
      toleranceValue: plan.toleranceValue,
      hardLimit: plan.hardLimit,
      dueValue: plan.dueValue,
    },
  };
}
