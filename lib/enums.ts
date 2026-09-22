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

export const PermitType = {
  BUILDING: 'BUILDING',
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING: 'PLUMBING',
  MECHANICAL: 'MECHANICAL',
  SEPTIC: 'SEPTIC',
  GRADING: 'GRADING',
  // Added for light-commercial tenant-improvement work, which routinely
  // pulls several concurrent permits from different authorities on
  // different clocks — building, fire marshal, sometimes health — rather
  // than the single building-department permit a residential job needs.
  FIRE: 'FIRE',
  HEALTH: 'HEALTH',
} as const;
export type PermitType = (typeof PermitType)[keyof typeof PermitType];

export const PermitStatus = {
  APPLIED: 'APPLIED',
  ISSUED: 'ISSUED',
  FINALED: 'FINALED',
  EXPIRED: 'EXPIRED',
} as const;
export type PermitStatus = (typeof PermitStatus)[keyof typeof PermitStatus];

export const InspectionType = {
  FOOTING: 'FOOTING',
  FOUNDATION: 'FOUNDATION',
  FRAMING: 'FRAMING',
  ROUGH_IN_ELECTRICAL: 'ROUGH_IN_ELECTRICAL',
  ROUGH_IN_PLUMBING: 'ROUGH_IN_PLUMBING',
  ROUGH_IN_MECHANICAL: 'ROUGH_IN_MECHANICAL',
  INSULATION: 'INSULATION',
  FINAL: 'FINAL',
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

export const InspectionStatus = {
  NOT_SCHEDULED: 'NOT_SCHEDULED',
  SCHEDULED: 'SCHEDULED',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
} as const;
export type InspectionStatus = (typeof InspectionStatus)[keyof typeof InspectionStatus];

// How a re-inspection after a failure actually gets scheduled — modeled on
// the three channels a real jurisdiction (Portland, OR) documents, plus the
// baseline in-person visit every jurisdiction supports.
export const ReinspectionChannel = {
  REMOTE_VIDEO: 'REMOTE_VIDEO',
  ONLINE_PORTAL: 'ONLINE_PORTAL',
  PHONE: 'PHONE',
  IN_PERSON: 'IN_PERSON',
} as const;
export type ReinspectionChannel = (typeof ReinspectionChannel)[keyof typeof ReinspectionChannel];

// See the long comment on WorkerCertification.renewalPattern in
// schema.prisma for what each of these four real-world renewal shapes means
// and why one expiryDate field can't honestly represent all of them alike.
export const RenewalPattern = {
  HARD_EXPIRY: 'HARD_EXPIRY',
  INFORMAL_RECENCY: 'INFORMAL_RECENCY',
  GRACE_PERIOD: 'GRACE_PERIOD',
  LICENSE_CYCLE: 'LICENSE_CYCLE',
} as const;
export type RenewalPattern = (typeof RenewalPattern)[keyof typeof RenewalPattern];

// A subcontractor's certificate of insurance bundles several of these, each
// with its own carrier, policy number, and expiry — see SubcontractorCOI.
export const CoverageType = {
  GENERAL_LIABILITY: 'GENERAL_LIABILITY',
  WORKERS_COMP: 'WORKERS_COMP',
  COMMERCIAL_AUTO: 'COMMERCIAL_AUTO',
  UMBRELLA: 'UMBRELLA',
  PROFESSIONAL_LIABILITY: 'PROFESSIONAL_LIABILITY',
} as const;
export type CoverageType = (typeof CoverageType)[keyof typeof CoverageType];

// --- Enterprise-scale additions: lien waivers, safety incidents, JHAs,
// worker screening, certified payroll, and the audit log. See the README's
// "Scaling to enterprise" section for what each of these is (and isn't) —
// these are real, usable domain features, not a full compliance-department
// replacement.

// The four waiver shapes a GC actually tracks against a pay application:
// conditional (takes effect once the payment clears) vs. unconditional
// (takes effect immediately, so it should only be exchanged for a payment
// already in hand), and progress (this pay period) vs. final (the last
// dollar owed on the contract). Mixing these up is exactly the kind of
// mistake that costs real money — an unconditional waiver signed before
// payment clears gives up lien rights with nothing to show for it.
export const LienWaiverType = {
  CONDITIONAL_PROGRESS: 'CONDITIONAL_PROGRESS',
  UNCONDITIONAL_PROGRESS: 'UNCONDITIONAL_PROGRESS',
  CONDITIONAL_FINAL: 'CONDITIONAL_FINAL',
  UNCONDITIONAL_FINAL: 'UNCONDITIONAL_FINAL',
} as const;
export type LienWaiverType = (typeof LienWaiverType)[keyof typeof LienWaiverType];

export const LienWaiverStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  DISPUTED: 'DISPUTED',
} as const;
export type LienWaiverStatus = (typeof LienWaiverStatus)[keyof typeof LienWaiverStatus];

// A near miss is deliberately its own first-class type, not a lesser
// severity of INJURY — it's the leading indicator a real safety program
// actually tracks trends against, and burying it as "low severity injury"
// would make it invisible in exactly the reports meant to surface it.
export const IncidentType = {
  NEAR_MISS: 'NEAR_MISS',
  INJURY: 'INJURY',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  ENVIRONMENTAL: 'ENVIRONMENTAL',
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

export const IncidentSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const ScreeningType = {
  DRUG_TEST: 'DRUG_TEST',
  BACKGROUND_CHECK: 'BACKGROUND_CHECK',
} as const;
export type ScreeningType = (typeof ScreeningType)[keyof typeof ScreeningType];

export const ScreeningResult = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING: 'PENDING',
} as const;
export type ScreeningResult = (typeof ScreeningResult)[keyof typeof ScreeningResult];

export const PayrollEntryStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
} as const;
export type PayrollEntryStatus = (typeof PayrollEntryStatus)[keyof typeof PayrollEntryStatus];

// The "viewing as" role switcher (see components/RoleSwitcher.tsx and
// lib/role.ts) — a UI-only demonstration of role-scoped views, explicitly
// NOT real access control. See lib/role.ts for what that distinction means
// and why it matters.
export const ViewingRole = {
  EXECUTIVE: 'EXECUTIVE',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  SUPERINTENDENT: 'SUPERINTENDENT',
  SAFETY_DIRECTOR: 'SAFETY_DIRECTOR',
  SUBCONTRACTOR: 'SUBCONTRACTOR',
  FIELD_WORKER: 'FIELD_WORKER',
} as const;
export type ViewingRole = (typeof ViewingRole)[keyof typeof ViewingRole];
