/**
 * Focused regression coverage for the readiness roll-up.
 *
 * New domain tests should follow this small-file pattern. The legacy
 * domain.smoke.ts suite remains in place until its sections are migrated
 * without losing coverage.
 */
import { computeReadiness, permitsStatusFrom } from '../readiness';

let passed = 0;
let failed = 0;

function equal(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  PASS  ${label}`);
    return;
  }

  failed++;
  console.error(`  FAIL  ${label}`);
  console.error(`        expected: ${JSON.stringify(expected)}`);
  console.error(`        actual:   ${JSON.stringify(actual)}`);
}

console.log('readiness.test.ts — explainable readiness regression coverage');

equal(
  'all healthy components produce an overall ok verdict',
  computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'ok', weather: 'ok', permits: 'ok' }).overall,
  'ok',
);

equal(
  'one warning raises the overall verdict to warning',
  computeReadiness({ crew: 'ok', equipment: 'warning', compliance: 'ok', weather: 'ok', permits: 'ok' }).overall,
  'warning',
);

equal(
  'one blocked component blocks the overall job',
  computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'blocked', weather: 'warning', permits: 'ok' }).overall,
  'blocked',
);

equal(
  'unknown never silently passes as ok',
  computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'ok', weather: 'unknown', permits: 'ok' }).overall,
  'unknown',
);

equal(
  'a real blocker outranks unknown',
  computeReadiness({ crew: 'blocked', equipment: 'ok', compliance: 'ok', weather: 'unknown', permits: 'ok' }).overall,
  'blocked',
);

equal(
  'failed inspection blocks permits',
  permitsStatusFrom({
    hasFailedInspection: true,
    hasExpiredPermit: false,
    hasOverdueInspection: false,
    hasInspectionDueSoon: false,
  }),
  'blocked',
);

equal(
  'expired permit blocks permits',
  permitsStatusFrom({
    hasFailedInspection: false,
    hasExpiredPermit: true,
    hasOverdueInspection: false,
    hasInspectionDueSoon: false,
  }),
  'blocked',
);

equal(
  'overdue unresolved inspection blocks permits',
  permitsStatusFrom({
    hasFailedInspection: false,
    hasExpiredPermit: false,
    hasOverdueInspection: true,
    hasInspectionDueSoon: false,
  }),
  'blocked',
);

equal(
  'inspection due soon warns rather than blocks',
  permitsStatusFrom({
    hasFailedInspection: false,
    hasExpiredPermit: false,
    hasOverdueInspection: false,
    hasInspectionDueSoon: true,
  }),
  'warning',
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
