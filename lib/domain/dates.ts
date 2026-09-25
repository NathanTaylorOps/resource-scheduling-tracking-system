/**
 * Calendar-day arithmetic and formatting in the company's own timezone.
 *
 * Every DateTime this app stores is an instant (UTC under the hood). What a
 * person means by a date, though, is a calendar day where the company
 * operates: a certification "good through 25 Sep" is good until the end of
 * 25 Sep in the office's timezone, not until UTC midnight, and "today's
 * daily log" is today where the crew is standing. So:
 *
 *   - A date typed into a form ("2026-09-25") is parsed as midnight of that
 *     day in APP_TIMEZONE (parseDateOnly), and an inclusive end date is
 *     stored as the last millisecond of that day (endOfDay).
 *   - Day-granularity comparisons (calendarDaysUntil, isPastCalendarDate)
 *     compare calendar dates in APP_TIMEZONE, never raw milliseconds.
 *   - Display goes through formatDate / formatDateTime, which render an
 *     unambiguous "24 Sep 2026" in APP_TIMEZONE on server and client alike.
 *
 * APP_TIMEZONE defaults to America/Los_Angeles, matching the Pacific
 * Northwest demo data; next.config.js inlines it into both server and client
 * bundles so the two can never disagree. Everything here is plain
 * TypeScript on top of Intl — no framework or library dependency — so it
 * runs under the domain test suite.
 */

export const DEFAULT_APP_TIMEZONE = 'America/Los_Angeles';

export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_NO_ZONE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let resolvedAppTimeZone: string | null = null;

function isKnownTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The timezone every calendar-day decision and every displayed date uses. */
export function appTimeZone(): string {
  if (resolvedAppTimeZone) return resolvedAppTimeZone;
  const configured = typeof process !== 'undefined' ? process.env?.APP_TIMEZONE : undefined;
  resolvedAppTimeZone = configured && isKnownTimeZone(configured) ? configured : DEFAULT_APP_TIMEZONE;
  return resolvedAppTimeZone;
}

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(tz, formatter);
  }
  return formatter;
}

/** What a clock on the wall in `tz` reads at the instant `date`. */
export function wallClock(date: Date, tz: string = appTimeZone()): WallClock {
  const parts = partsFormatter(tz).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute'), second: read('second') };
}

/** Milliseconds by which `tz`'s wall clock is ahead of UTC at `date`. */
function offsetMs(date: Date, tz: string): number {
  const w = wallClock(date, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which `tz`'s wall clock reads the given fields. Guesses by
 * treating the wall-clock fields as UTC, then corrects by the zone offset at
 * that guess, and corrects once more in case the guess straddled a DST
 * change.
 */
function fromWallClock(wallUtcMs: number, tz: string): Date {
  let guess = wallUtcMs - offsetMs(new Date(wallUtcMs), tz);
  const correction = wallUtcMs - offsetMs(new Date(guess), tz);
  if (correction !== guess) guess = correction;
  return new Date(guess);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** The calendar date ("YYYY-MM-DD") that `date` falls on in `tz`. */
export function dateKey(date: Date, tz: string = appTimeZone()): string {
  const w = wallClock(date, tz);
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
}

/** Today's calendar date in the app timezone, as "YYYY-MM-DD". */
export function todayISO(tz: string = appTimeZone(), now: Date = new Date()): string {
  return dateKey(now, tz);
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * Parses a date-only string ("2026-09-25", the shape an <input type="date">
 * submits) to midnight of that day in `tz`. Returns null for anything that
 * isn't a real calendar date.
 */
export function parseDateOnly(value: string, tz: string = appTimeZone()): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!isRealCalendarDate(year, month, day)) return null;
  return fromWallClock(Date.UTC(year, month - 1, day), tz);
}

/**
 * Parses any date input a form or API client might send:
 *   - "YYYY-MM-DD"            → midnight of that day in `tz`
 *   - "YYYY-MM-DDTHH:mm[:ss]" → that wall-clock time in `tz` (an
 *                               <input type="datetime-local"> value)
 *   - anything with an explicit zone or offset → parsed as the instant it names
 * Returns null when the value can't be read as a date at all.
 */
export function parseDateInput(value: string, tz: string = appTimeZone()): Date | null {
  const trimmed = value.trim();
  const dateOnly = parseDateOnly(trimmed, tz);
  if (dateOnly) return dateOnly;
  const local = DATE_TIME_NO_ZONE_PATTERN.exec(trimmed);
  if (local) {
    const [year, month, day, hour, minute, second] = [1, 2, 3, 4, 5, 6].map((i) => Number(local[i] ?? 0));
    if (!isRealCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
    return fromWallClock(Date.UTC(year, month - 1, day, hour, minute, second), tz);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Shifts a "YYYY-MM-DD" key by whole calendar days. Pure calendar arithmetic, no timezone involved. */
export function addCalendarDays(key: string, days: number): string {
  const match = DATE_ONLY_PATTERN.exec(key);
  if (!match) throw new Error(`addCalendarDays: "${key}" is not a YYYY-MM-DD date`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Midnight in `tz` of the calendar day `date` falls on. */
export function startOfDay(date: Date, tz: string = appTimeZone()): Date {
  return parseDateOnly(dateKey(date, tz), tz)!;
}

/** The last millisecond of the calendar day `date` falls on in `tz` — how an inclusive end date is stored. */
export function endOfDay(date: Date, tz: string = appTimeZone()): Date {
  const nextMidnight = parseDateOnly(addCalendarDays(dateKey(date, tz), 1), tz)!;
  return new Date(nextMidnight.getTime() - 1);
}

/** Day of the week for a "YYYY-MM-DD" key: 0 = Sunday … 6 = Saturday. */
export function weekdayOfKey(key: string): number {
  const match = DATE_ONLY_PATTERN.exec(key);
  if (!match) throw new Error(`weekdayOfKey: "${key}" is not a YYYY-MM-DD date`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

export function isWeekendKey(key: string): boolean {
  const weekday = weekdayOfKey(key);
  return weekday === 0 || weekday === 6;
}

function keyToUtcMs(key: string): number {
  const match = DATE_ONLY_PATTERN.exec(key)!;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Whole calendar days from `now`'s day to `target`'s day, both read in the
 * app timezone. Positive while `target` is still ahead, zero on the day
 * itself, negative once the day has passed. Use this — never raw
 * millisecond subtraction — wherever a day-granularity threshold decides
 * something: a date-only field names a whole day, and a credential good
 * "through" 25 Sep must stay valid until 25 Sep is over where the crew is.
 */
export function calendarDaysUntil(target: Date, now: Date, tz: string = appTimeZone()): number {
  return Math.round((keyToUtcMs(dateKey(target, tz)) - keyToUtcMs(dateKey(now, tz))) / DAY_MS);
}

/** True once `now`'s calendar date is strictly after `target`'s. */
export function isPastCalendarDate(target: Date, now: Date, tz: string = appTimeZone()): boolean {
  return calendarDaysUntil(target, now, tz) < 0;
}

/** Whole calendar days from `from` to `to`, the same comparison as calendarDaysUntil generalized to two arbitrary dates. */
export function calendarDaysBetween(from: Date, to: Date, tz: string = appTimeZone()): number {
  return calendarDaysUntil(to, from, tz);
}

function coerceDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "24 Sep 2026" — day, three-letter month, four-digit year, in the app
 * timezone. Unambiguous to a reader anywhere, and built from a fixed month
 * table rather than a locale so the server and the browser can't render
 * the same value two different ways.
 */
export function formatDate(value: Date | string | number | null | undefined, tz: string = appTimeZone()): string {
  if (value == null) return '';
  const date = coerceDate(value);
  if (!date) return '';
  const w = wallClock(date, tz);
  return `${w.day} ${MONTH_ABBREVIATIONS[w.month - 1]} ${w.year}`;
}

/** "24 Sep 2026, 14:05" — formatDate plus a 24-hour time, in the app timezone. */
export function formatDateTime(value: Date | string | number | null | undefined, tz: string = appTimeZone()): string {
  if (value == null) return '';
  const date = coerceDate(value);
  if (!date) return '';
  const w = wallClock(date, tz);
  return `${w.day} ${MONTH_ABBREVIATIONS[w.month - 1]} ${w.year}, ${pad2(w.hour)}:${pad2(w.minute)}`;
}

/** "Wed" — the short weekday name for the app-timezone day `date` falls on. */
export function formatWeekday(value: Date, tz: string = appTimeZone()): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekdayOfKey(dateKey(value, tz))];
}

/** The day-of-month number for the app-timezone day `date` falls on. */
export function dayOfMonth(value: Date, tz: string = appTimeZone()): number {
  return wallClock(value, tz).day;
}
