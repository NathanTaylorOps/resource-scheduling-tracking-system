/**
 * Forward equipment-reservation conflicts.
 *
 * Equipment.currentJobId (see the Prisma schema) is custody — where an asset
 * physically is right now, set by scan events. A reservation is a plan for
 * where it's going to be. This module answers the planning question a
 * superintendent actually needs answered before it becomes a problem: is
 * this asset booked to two jobs over an overlapping window?
 *
 * The algorithm is the same all-pairs interval-overlap check findOverlaps in
 * scheduling.ts uses for worker double-booking, applied to equipmentId
 * instead of workerId — every pair of an asset's reservations is compared,
 * not just neighbors in start-time order, so a reservation nested inside a
 * longer one is still caught. Kept as its own module rather than a
 * generalized version of findOverlaps: a worker double-booking and an
 * equipment double-booking read as genuinely different situations to a
 * superintendent, even though the underlying interval math is identical, and
 * unlike a worker's roleOnJob, no reservation here is ever exempt — an asset
 * can't be on two jobs at once regardless of what either job needs it for.
 */

export interface EquipmentReservation {
  id: string;
  equipmentId: string;
  jobId: string;
  start: Date;
  end: Date;
}

export interface EquipmentReservationConflict {
  equipmentId: string;
  first: EquipmentReservation;
  second: EquipmentReservation;
}

export function findEquipmentConflicts(
  reservations: EquipmentReservation[],
): EquipmentReservationConflict[] {
  const byEquipment = new Map<string, EquipmentReservation[]>();

  for (const reservation of reservations) {
    const list = byEquipment.get(reservation.equipmentId) ?? [];
    list.push(reservation);
    byEquipment.set(reservation.equipmentId, list);
  }

  const conflicts: EquipmentReservationConflict[] = [];

  for (const [equipmentId, list] of byEquipment) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const overlaps = a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
        if (!overlaps) continue;

        const [first, second] = a.start.getTime() <= b.start.getTime() ? [a, b] : [b, a];
        conflicts.push({ equipmentId, first, second });
      }
    }
  }

  return conflicts;
}
