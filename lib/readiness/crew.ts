import { findOverlaps, findUnfilledRoles, type Assignment as OverlapAssignment } from '@/lib/domain/scheduling';
import { crewStatusFrom, type ComponentStatus } from '@/lib/domain/readiness';

export function evaluateCrewReadiness(input: {
  jobId: string;
  assignments: Array<{ workerId: string; roleOnJob: string }>;
  roleRequirements: Array<{ id: string; roleOrTrade: string; requiredCount: number }>;
  allAssignmentsForCrew: Array<{ id: string; workerId: string; jobId: string; roleOnJob: string; start: Date; end: Date }>;
}): { status: ComponentStatus; reason?: string } {
  const overlapInput: OverlapAssignment[] = input.allAssignmentsForCrew.map((a) => ({ ...a }));
  const conflicts = findOverlaps(overlapInput);
  const hasOverlapConflict = conflicts.some((c) => c.first.jobId === input.jobId || c.second.jobId === input.jobId);
  const hasUnfilledRole = findUnfilledRoles(input.roleRequirements, input.assignments).length > 0;
  return {
    status: crewStatusFrom({ hasOverlapConflict, hasUnfilledRole }),
    reason: hasOverlapConflict
      ? 'A crew member is double-booked against another job.'
      : hasUnfilledRole ? 'A required role on the staffing plan has nobody assigned.' : undefined,
  };
}
