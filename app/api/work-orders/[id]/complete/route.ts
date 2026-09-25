import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { WorkOrderStatus, WorkOrderSource, EquipmentStatus } from '@/lib/enums';
import { applyCompletionToHierarchy } from '@/lib/domain/maintenance';
import { resolveCounterValue, toDomainPlan } from '@/lib/readiness-service';
import { apiError } from '@/lib/api';
import { parseJsonBody, optionalString, optionalNumber, NotFoundError, ValidationError, ConflictError } from '@/lib/validate';

/**
 * Marks a work order complete. When it's tied to a preventive-maintenance
 * plan, this is also where the schedule actually advances (see
 * recordCompletion in lib/domain/compliance.ts for the early / on-time /
 * late rules) and where a nested child plan the same service covers gets
 * suppressed for this cycle instead of generating a duplicate line item,
 * per lib/domain/maintenance.ts. A defect-sourced work order with no plan
 * behind it just closes out, and if it was the last thing keeping the
 * asset down, clears DOWN_FOR_SERVICE.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prisma = getDb();
    const workOrder = await prisma.workOrder.findUnique({ where: { id: params.id } });
    if (!workOrder) {
      throw new NotFoundError('Work order not found.');
    }
    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      // Fast path only — a friendlier, immediate response for the common
      // case (a stale page, a double-click). The real guard against two
      // *concurrent* completions is the atomic claim inside the transaction
      // below.
      throw new ValidationError('This work order is already completed.');
    }

    const body = await parseJsonBody(request, { allowEmpty: true });
    const requestedCompletedAtValue = optionalNumber(body, 'completedAtValue', { min: 0 }, 'Counter value at completion must be a non-negative number.');
    const notes = optionalString(body, 'notes');
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Atomically claim this work order before doing anything else. The
      // WHERE clause's status condition and the write happen as one
      // statement, so of two transactions racing on the same work order,
      // only the first to reach this line can match `status: { not:
      // COMPLETED }`; the second gets `count === 0` and bails out before
      // the maintenance-plan math ever runs a second time.
      const claim = await tx.workOrder.updateMany({
        where: { id: workOrder.id, status: { not: WorkOrderStatus.COMPLETED } },
        data: { status: WorkOrderStatus.COMPLETED, completedAt: now },
      });
      if (claim.count === 0) {
        throw new ConflictError('This work order was already completed by another request.');
      }

      let completedAtValue: number | null = requestedCompletedAtValue;
      const advancedPlans: Array<{ planId: string; dueValue: number }> = [];

      if (workOrder.maintenancePlanId) {
        const equipment = await tx.equipment.findUniqueOrThrow({
          where: { id: workOrder.equipmentId },
          include: { lifeCounters: true, maintenancePlans: true },
        });
        const plan = equipment.maintenancePlans.find((p) => p.id === workOrder.maintenancePlanId);
        if (!plan) {
          throw new ConflictError('The maintenance plan behind this work order no longer exists.');
        }

        if (completedAtValue === null) {
          completedAtValue = resolveCounterValue(plan.counterType, equipment, now);
        }
        if (completedAtValue === null) {
          throw new ValidationError('No reading is on file for this asset — enter the counter value at completion.');
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

      // status/completedAt were already set atomically by the claim above;
      // this fills in the fields that depend on the hierarchy math.
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          completedAtValue: completedAtValue ?? undefined,
          description: notes ? `${workOrder.description} — Completed: ${notes}` : workOrder.description,
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
    return apiError(err);
  }
}
