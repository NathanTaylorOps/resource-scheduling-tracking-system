/**
 * Forward equipment-reservation conflicts.
 *
 * Equipment.currentJobId (see the Prisma schema) is custody — where an asset
 * physically is right now, set by scan events. A reservation is a plan for
 * where it's going to be. This module answers the planning question a
 * superintendent actually needs answered before it becomes a problem: is
 * this asset booked to two jobs over an overlapping window?
 *
 * The algorithm is the same interval-sweep findOverlaps in scheduling.ts
 * uses for worker double-booking, applied to equipmentId instead of
 * workerId. Kept as its own module rather than a generalized version of
 * findOverlaps: a worker double-booking and an equipment double-booking read
 * as genuinely different situations to a superintendent, even though the
 * underlying interval math is identical.
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
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (next.start.getTime() < current.end.getTime()) {
        conflicts.push({ equipmentId, first: current, second: next });
      }
    }
  }

  return conflicts;
}
