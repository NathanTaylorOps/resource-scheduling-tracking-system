import { addCalendarDays, parseDateOnly, todayISO } from './dates';

/** Assignments are half-open [start,end): an assignment ending at local midnight
 * is not working on the following day. Include partial-day assignments.
 */
export function assignmentsForWorkday<T extends { start: Date; end: Date }>(
  assignments: T[],
  dayKey: string = todayISO(),
): T[] {
  const start = parseDateOnly(dayKey);
  const end = parseDateOnly(addCalendarDays(dayKey, 1));
  if (!start || !end) throw new Error('Invalid workday');
  return assignments.filter(a => a.start < end && a.end > start);
}
