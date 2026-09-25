/**
 * Request-body validation for the API routes — small, dependency-free, and
 * strict about shape. A body that isn't a JSON object, a field that's the
 * wrong type, a date that doesn't parse: each throws a RequestError with a
 * message meant for the person who submitted the form, and lib/api.ts turns
 * that into the matching 4xx. Anything else that escapes a route is a bug,
 * logged server-side and answered with a generic 500 — a raw error message
 * never reaches the client.
 *
 * Every helper takes the parsed body and a key rather than a bare value so
 * "absent", "null", and "present but wrong" are distinguishable — the PATCH
 * routes rely on `has()` to update only the fields a client actually sent.
 */

import { parseDateInput } from './domain/dates';

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

export class ValidationError extends RequestError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends RequestError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends RequestError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export type JsonObject = Record<string, unknown>;

const MALFORMED = 'Malformed request.';

/** Narrows a parsed JSON value to a plain object; null, arrays, and primitives are all malformed bodies. */
export function asJsonObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(MALFORMED);
  }
  return value as JsonObject;
}

/**
 * Reads and parses a request body as a JSON object. Works with anything that
 * exposes `text()` (a fetch Request, a NextRequest, or a test double). With
 * `allowEmpty`, an empty body reads as `{}` — for routes whose every field
 * is optional.
 */
export async function parseJsonBody(request: { text(): Promise<string> }, options: { allowEmpty?: boolean } = {}): Promise<JsonObject> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ValidationError(MALFORMED);
  }
  if (raw.trim() === '') {
    if (options.allowEmpty) return {};
    throw new ValidationError(MALFORMED);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError(MALFORMED);
  }
  return asJsonObject(parsed);
}

/** True when the client sent this key at all, including as null. */
export function has(body: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

/** A trimmed, non-empty string. Absent, empty, or not a string → `message`. */
export function requiredString(body: JsonObject, key: string, message: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError(message);
  return value.trim();
}

/** A trimmed string or null. Absent, null, or blank → null; any other non-string → error. */
export function optionalString(body: JsonObject, key: string, message = `${key} must be text.`): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError(message);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** A date the client sent as a string (see parseDateInput for the accepted shapes). Absent or unparseable → `message`. */
export function requiredDate(body: JsonObject, key: string, message: string): Date {
  const value = body[key];
  if (typeof value !== 'string') throw new ValidationError(message);
  const parsed = parseDateInput(value);
  if (!parsed) throw new ValidationError(message);
  return parsed;
}

/** A date or null. Absent, null, or blank → null; present but unparseable → `message`. */
export function optionalDate(body: JsonObject, key: string, message: string): Date | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError(message);
  if (value.trim() === '') return null;
  const parsed = parseDateInput(value);
  if (!parsed) throw new ValidationError(message);
  return parsed;
}

export interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
}

function checkNumber(value: unknown, rule: NumberRule, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(message);
  if (rule.integer && !Number.isInteger(value)) throw new ValidationError(message);
  if (rule.min !== undefined && value < rule.min) throw new ValidationError(message);
  if (rule.max !== undefined && value > rule.max) throw new ValidationError(message);
  return value;
}

/** A finite JSON number satisfying `rule`. Absent, non-numeric, or out of range → `message`. */
export function requiredNumber(body: JsonObject, key: string, rule: NumberRule, message: string): number {
  return checkNumber(body[key], rule, message);
}

/** A finite JSON number satisfying `rule`, or null when absent/null. Present but wrong → `message`. */
export function optionalNumber(body: JsonObject, key: string, rule: NumberRule, message: string): number | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  return checkNumber(value, rule, message);
}

type EnumValues<T extends string> = readonly T[] | Record<string, T>;

function enumList<T extends string>(values: EnumValues<T>): readonly T[] {
  return Array.isArray(values) ? (values as readonly T[]) : (Object.values(values) as T[]);
}

/** One of `values` (an array, or one of the const objects in lib/enums.ts). Absent or anything else → `message`. */
export function requiredEnum<T extends string>(body: JsonObject, key: string, values: EnumValues<T>, message: string): T {
  const value = body[key];
  const allowed = enumList(values);
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new ValidationError(message);
  return value as T;
}

/** One of `values`, or `fallback` when absent/null. Present but not a member → `message`. */
export function optionalEnum<T extends string>(body: JsonObject, key: string, values: EnumValues<T>, fallback: T, message: string): T {
  const value = body[key];
  if (value === undefined || value === null) return fallback;
  return requiredEnum(body, key, values, message);
}

/** A boolean, defaulting to false when absent/null. Anything else → error. */
export function optionalBoolean(body: JsonObject, key: string, message = `${key} must be true or false.`): boolean {
  const value = body[key];
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') throw new ValidationError(message);
  return value;
}

/** An array of non-empty strings, deduplicated and trimmed; absent/null → []. Anything else → `message`. */
export function optionalStringArray(body: JsonObject, key: string, message: string): string[] {
  const value = body[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new ValidationError(message);
  return [...new Set((value as string[]).map((item) => item.trim()).filter(Boolean))];
}

/** Checks that latitude and longitude are numbers inside the ranges a real coordinate can take. */
export function requiredCoordinates(body: JsonObject, latKey = 'latitude', lngKey = 'longitude'): { latitude: number; longitude: number } {
  const latitude = requiredNumber(body, latKey, { min: -90, max: 90 }, 'Enter a valid latitude, between -90 and 90.');
  const longitude = requiredNumber(body, lngKey, { min: -180, max: 180 }, 'Enter a valid longitude, between -180 and 180.');
  return { latitude, longitude };
}

/** Like requiredCoordinates, but both may be absent — a scan from a device with no GPS fix. One without the other, or a value out of range, is an error. */
export function optionalCoordinates(body: JsonObject, latKey = 'latitude', lngKey = 'longitude'): { latitude: number | null; longitude: number | null } {
  const latitude = optionalNumber(body, latKey, { min: -90, max: 90 }, 'Latitude must be a number between -90 and 90.');
  const longitude = optionalNumber(body, lngKey, { min: -180, max: 180 }, 'Longitude must be a number between -180 and 180.');
  if ((latitude === null) !== (longitude === null)) {
    throw new ValidationError('Send both latitude and longitude, or neither.');
  }
  return { latitude, longitude };
}
