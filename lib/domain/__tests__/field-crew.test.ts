import assert from 'node:assert/strict';
import { assignmentsForWorkday } from '../field-crew';
import { parseDateOnly, addCalendarDays } from '../dates';

const day = '2026-10-11';
const start = parseDateOnly(day)!;
const next = parseDateOnly(addCalendarDays(day, 1))!;
const yesterday = parseDateOnly(addCalendarDays(day, -1))!;
const tomorrow = parseDateOnly(addCalendarDays(day, 2))!;
const cases = [
  { name: 'ends at start of day', start: yesterday, end: start },
  { name: 'starts at day start', start, end: next },
  { name: 'spans day', start: yesterday, end: tomorrow },
  { name: 'starts at next midnight', start: next, end: tomorrow },
];
assert.deepEqual(assignmentsForWorkday(cases, day).map(x => x.name), [
  'starts at day start', 'spans day',
]);
assert.deepEqual(assignmentsForWorkday([], day), []);
assert.throws(() => assignmentsForWorkday(cases, 'invalid'), /Invalid workday/);
assert.throws(() => assignmentsForWorkday(cases, '2026-02-30'), /Invalid workday/);
console.log('PASS field crew local-day half-open assignment selection');
