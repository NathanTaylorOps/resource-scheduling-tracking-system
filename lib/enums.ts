/**
 * Single source of truth for the fixed-value fields that would be Prisma
 * `enum`s if the datasource were Postgres or MySQL. SQLite has no native
 * enum column type, so Prisma's SQLite connector doesn't support the `enum`
 * keyword in schema.prisma at all — those fields are stored as plain
 * Strings instead (see the note at the top of prisma/schema.prisma).
 *
 * The const-object-plus-derived-union-type pattern below gives the rest of
 * the app the same two things a real generated Prisma enum would: a value
 * namespace (JobStatus.ACTIVE) and a type of the same name (JobStatus) for
 * annotations — so call sites elsewhere in the codebase are unaffected by
 * the fact that these aren't database-level enums.
 */

export const JobStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETE: 'COMPLETE',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const WeatherSensitivity = {
  INSENSITIVE: 'INSENSITIVE',
  CONDITIONAL: 'CONDITIONAL',
  SENSITIVE: 'SENSITIVE',
} as const;
export type WeatherSensitivity = (typeof WeatherSensitivity)[keyof typeof WeatherSensitivity];

export const EmploymentType = {
  DIRECT_EMPLOYEE: 'DIRECT_EMPLOYEE',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const EquipmentStatus = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
  IN_TRANSIT: 'IN_TRANSIT',
  DOWN_FOR_SERVICE: 'DOWN_FOR_SERVICE',
  RETIRED: 'RETIRED',
} as const;
export type EquipmentStatus = (typeof EquipmentStatus)[keyof typeof EquipmentStatus];

export const CounterType = {
  CALENDAR_DAYS: 'CALENDAR_DAYS',
  RUN_HOURS: 'RUN_HOURS',
  CYCLES: 'CYCLES',
} as const;
export type CounterType = (typeof CounterType)[keyof typeof CounterType];

export const ComplianceType = {
  CALIBRATION: 'CALIBRATION',
  INSPECTION: 'INSPECTION',
  WARRANTY: 'WARRANTY',
} as const;
export type ComplianceType = (typeof ComplianceType)[keyof typeof ComplianceType];

export const WorkOrderSource = {
  SCHEDULED: 'SCHEDULED',
  DEFECT_REPORTED: 'DEFECT_REPORTED',
} as const;
export type WorkOrderSource = (typeof WorkOrderSource)[keyof typeof WorkOrderSource];

export const WorkOrderStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

export const ScanAction = {
  CHECK_OUT: 'CHECK_OUT',
  CHECK_IN: 'CHECK_IN',
  LOCATION_UPDATE: 'LOCATION_UPDATE',
  DEFECT_REPORTED: 'DEFECT_REPORTED',
} as const;
export type ScanAction = (typeof ScanAction)[keyof typeof ScanAction];

export const WeatherLayer = {
  FORECAST: 'FORECAST',
  OUTLOOK: 'OUTLOOK',
} as const;
export type WeatherLayer = (typeof WeatherLayer)[keyof typeof WeatherLayer];
