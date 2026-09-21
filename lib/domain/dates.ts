/**
 * Whole calendar days between two instants, measured by UTC calendar date
 * rather than exact elapsed milliseconds.
 *
 * A stored date-only field (a certification's expiryDate, a permit's
 * expiryDate) parses from a "YYYY-MM-DD" string to UTC midnight, with no
 * time-of-day information of its own — it names a day, not a moment.
 * Comparing that instant against the exact millisecond of `now` makes a
 * credential or permit good "through" its expiry date actually go dark at
 * UTC midnight, which is 5pm the previous day in US Pacific (more or less
 * depending on the season and where the server and the reader each sit) —
 * hours before anyone reading the printed date would consider it lapsed,
 * and for the one status (expired) that hard-blocks a crew assignment.
 *
 * Comparing by calendar date instead means a date-only field stays valid
 * for the entirety of the day it names, in UTC, regardless of what
 * timezone the server or the person reading it happens to be in. It isn't
 * a perfect fix for every timezone at once — a date-only field fundamentally
 * doesn't carry enough information for that — but it removes the specific,
 * silent early-expiry window the raw millisecond comparison created.
 */
export function calendarDaysUntil(target: Date, now: Date): number {
  const targetUtcDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((targetUtcDay - nowUtcDay) / (1000 * 60 * 60 * 24));
}

/** True once `now`'s UTC calendar date is strictly after `target`'s. */
export function isPastCalendarDate(target: Date, now: Date): boolean {
  return calendarDaysUntil(target, now) < 0;
}
