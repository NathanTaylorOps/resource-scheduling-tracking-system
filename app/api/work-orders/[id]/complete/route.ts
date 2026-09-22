import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { WorkOrderStatus, WorkOrderSource, EquipmentStatus } from '@/lib/enums';
import { applyCompletionToHierarchy } from '@/lib/domain/maintenance';
import { resolveCounterValue, toDomainPlan } from '@/lib/readiness-service';

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
class WorkOrderAlreadyCompletedError extends Error {}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const workOrder = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found.' }, { status: 404 });
  }
  if (workOrder.status === WorkOrderStatus.COMPLETED) {
    // Fast path only — a friendlier, immediate response for the common
    // case (a stale page, a double-click) where there's obviously nothing
    // to race against. The real guard against two *concurrent* completions
    // is the atomic claim inside the transaction below; this check alone
    // can't prevent that, since two requests can both read "not completed"
    // here before either has written anything.
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
      // Atomically claim this work order before doing anything else in the
      // transaction — this is the actual concurrency guard, not the
      // pre-transaction check above. The WHERE clause's status condition
      // and the write happen as one statement, so of two transactions
      // racing on the same work order, only the first to reach this line
      // can match `status: { not: COMPLETED }`; by the time the second
      // one's write is allowed to proceed, the row is already COMPLETED
      // and it gets `count === 0` and bails out below — before either the
      // maintenance-plan due-date math or the child-work-order cascade
      // ever runs a second time.
      const claim = await tx.workOrder.updateMany({
        where: { id: workOrder.id, status: { not: WorkOrderStatus.COMPLETED } },
        data: { status: WorkOrderStatus.COMPLETED, completedAt: now },
      });
      if (claim.count === 0) {
        throw new WorkOrderAlreadyCompletedError('This work order was already completed by another request.');
      }

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

      // status/completedAt were already set atomically by the claim above;
      // this just fills in the fields that depend on the hierarchy math
      // that had to happen after the claim (completedAtValue may come from
      // resolveCounterValue, which needs the claim to have already
      // succeeded before it's safe to trust this request "owns" the
      // completion).
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
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
    if (err instanceof WorkOrderAlreadyCompletedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'The work order could not be completed.' },
      { status: 400 },
    );
  }
}
