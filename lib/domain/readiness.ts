/**
 * Composite job readiness score.
 *
 * Deliberately not a single opaque number. Each job carries five component
 * statuses — crew, equipment, compliance, weather, permits — and the overall
 * readiness is the worst of the five, shown alongside the breakdown rather
 * than in place of it. A PM should be able to see at a glance *why* a job
 * isn't ready, not just that it isn't.
 */

/**
 * 'unknown' is distinct from 'ok': it means this component hasn't actually
 * been evaluated against current data (the clearest case is weather — a job
 * nobody's opened yet has no forecast cached, since the forecast refreshes
 * on view rather than on a schedule; see lib/readiness-service.ts). Reading
 * that as 'ok' would be a false-green — exactly the kind of number this
 * tool is built not to show. It's ranked as seriously as 'warning' in the
 * rollup below: "we don't know" deserves the same glance-worthy attention
 * as "we know it's borderline," never the silence of "ok."
 */
export type ComponentStatus = 'ok' | 'warning' | 'blocked' | 'unknown';

export interface ReadinessInputs {
  crew: ComponentStatus;
  equipment: ComponentStatus;
  compliance: ComponentStatus;
  weather: ComponentStatus;
  permits: ComponentStatus;
}

export interface ReadinessResult extends ReadinessInputs {
  overall: ComponentStatus;
}

const SEVERITY: Record<ComponentStatus, number> = { ok: 0, unknown: 1, warning: 1, blocked: 2 };

export function computeReadiness(inputs: ReadinessInputs): ReadinessResult {
  const overall = ([inputs.crew, inputs.equipment, inputs.compliance, inputs.weather, inputs.permits] as const)
    .reduce<ComponentStatus>((worst, current) => {
      // An out-of-domain value can't reach here through TypeScript, but a
      // value that somehow isn't in SEVERITY (a bad cast, a future status
      // added to one union and not the other) must never win by silently
      // resolving to undefined and losing every comparison — that would
      // let a genuinely bad status hide behind whatever was already
      // worst. Fail loud instead of failing green.
      const currentSeverity = SEVERITY[current];
      if (currentSeverity === undefined) {
        throw new Error(`computeReadiness: unrecognized component status "${current}"`);
      }
      return currentSeverity > SEVERITY[worst] ? current : worst;
    }, 'ok');

  return { ...inputs, overall };
}

/** Derives a crew component status from unresolved scheduling issues. */
export function crewStatusFrom(params: {
  hasOverlapConflict: boolean;
  hasUnfilledRole: boolean;
}): ComponentStatus {
  if (params.hasOverlapConflict) return 'blocked';
  if (params.hasUnfilledRole) return 'warning';
  return 'ok';
}

/** Derives an equipment component status from assigned-asset conditions. */
export function equipmentStatusFrom(params: {
  hasAssetDownForService: boolean;
  hasAssetConflict: boolean;
}): ComponentStatus {
  if (params.hasAssetDownForService) return 'blocked';
  if (params.hasAssetConflict) return 'warning';
  return 'ok';
}

/** Derives a compliance component status from cert/calibration standing across the crew and assigned equipment. */
export function complianceStatusFrom(params: {
  hasExpiredItem: boolean;
  hasExpiringSoonItem: boolean;
}): ComponentStatus {
  if (params.hasExpiredItem) return 'blocked';
  if (params.hasExpiringSoonItem) return 'warning';
  return 'ok';
}

/** Derives a weather component status from the job's weather-sensitive tasks against the current outlook. */
export function weatherStatusFrom(params: {
  hasSevereRiskInForecastWindow: boolean;
  hasModerateRiskInForecastWindow: boolean;
}): ComponentStatus {
  if (params.hasSevereRiskInForecastWindow) return 'blocked';
  if (params.hasModerateRiskInForecastWindow) return 'warning';
  return 'ok';
}

/**
 * Derives a permits component status from permit and inspection standing.
 * A failed inspection or an expired permit blocks the job outright — work
 * can't legally proceed either way, regardless of who's on site or what
 * equipment is there. An inspection coming up soon is a heads-up, not a
 * blocker.
 */
export function permitsStatusFrom(params: {
  hasFailedInspection: boolean;
  hasExpiredPermit: boolean;
  hasInspectionDueSoon: boolean;
}): ComponentStatus {
  if (params.hasFailedInspection || params.hasExpiredPermit) return 'blocked';
  if (params.hasInspectionDueSoon) return 'warning';
  return 'ok';
}
