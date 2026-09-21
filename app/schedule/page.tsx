import { Fragment } from 'react';
import { prisma } from '@/lib/db';
import { findOverlaps, type Assignment as DomainAssignment } from '@/lib/domain/scheduling';

export const dynamic = 'force-dynamic';

// A three-week look-ahead is the horizon most GCs actually plan crew moves
// against — long enough to see what's coming, short enough that it doesn't
// turn into a wall of noise for jobs still months out.
const WINDOW_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function SchedulePage() {
  const windowStart = startOfDay(new Date());
  const windowEnd = new Date(windowStart.getTime() + WINDOW_DAYS * DAY_MS);

  const [workers, assignments] = await Promise.all([
    prisma.worker.findMany({ orderBy: { name: 'asc' } }),
    prisma.assignment.findMany({
      where: { start: { lt: windowEnd }, end: { gt: windowStart } },
      include: { job: true },
      orderBy: { start: 'asc' },
    }),
  ]);

  const assignmentsByWorker = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const list = assignmentsByWorker.get(assignment.workerId) ?? [];
    list.push(assignment);
    assignmentsByWorker.set(assignment.workerId, list);
  }

  const conflicts = findOverlaps(
    assignments.map<DomainAssignment>((a) => ({
      id: a.id,
      workerId: a.workerId,
      jobId: a.jobId,
      roleOnJob: a.roleOnJob,
      start: a.start,
      end: a.end,
    })),
  );
  const conflictedAssignmentIds = new Set(conflicts.flatMap((c) => [c.first.id, c.second.id]));

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => new Date(windowStart.getTime() + i * DAY_MS));
  const today = startOfDay(new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crew schedule</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Three-week look-ahead — every crew member with an assignment in this window.
        </p>
      </div>

      {conflicts.length > 0 && (
        <div className="card border-red-200 bg-red-50">
          <h2 className="mb-2 font-semibold text-red-800">Double-booked crew</h2>
          <ul className="space-y-1 text-sm text-red-700">
            {conflicts.map((conflict, index) => {
              const worker = workers.find((w) => w.id === conflict.workerId);
              const sameJob = conflict.first.jobId === conflict.second.jobId;
              return (
                <li key={index}>
                  {worker?.name ?? 'Unknown crew member'} —{' '}
                  {sameJob ? 'overlapping assignments on the same job' : 'assigned to two jobs at once'}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <div className="min-w-max">
          <div className="grid" style={{ gridTemplateColumns: `200px repeat(${WINDOW_DAYS}, 44px)` }}>
            <div className="sticky left-0 z-10 border-b border-r border-outdoor-border bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Crew
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`border-b border-outdoor-border py-2 text-center text-[10px] font-medium ${
                  isSameDay(day, today)
                    ? 'bg-zinc-900 text-white'
                    : isWeekend(day)
                    ? 'bg-outdoor-surface text-zinc-400'
                    : 'text-zinc-500'
                }`}
              >
                <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="font-semibold">{day.getDate()}</div>
              </div>
            ))}

            {workers.map((worker) => {
              const workerAssignments = assignmentsByWorker.get(worker.id) ?? [];
              return (
                <Fragment key={worker.id}>
                  <div className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-outdoor-border bg-white px-3 py-2">
                    <span className="text-sm font-medium">{worker.name}</span>
                    <span className="text-xs text-zinc-500">{worker.trade}</span>
                  </div>
                  <div className="relative border-b border-outdoor-border" style={{ gridColumn: `2 / span ${WINDOW_DAYS}` }}>
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${WINDOW_DAYS}, 44px)` }}>
                      {days.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={`border-r border-outdoor-border/50 ${isWeekend(day) ? 'bg-outdoor-surface' : ''}`}
                        />
                      ))}
                    </div>
                    {workerAssignments.map((assignment) => {
                      const startOffset = dayOffset(assignment.start, windowStart);
                      const endOffset = dayOffset(assignment.end, windowStart);
                      const left = (startOffset / WINDOW_DAYS) * 100;
                      const width = Math.max(((endOffset - startOffset) / WINDOW_DAYS) * 100, 2);
                      const conflicted = conflictedAssignmentIds.has(assignment.id);
                      return (
                        <div
                          key={assignment.id}
                          title={`${assignment.job.name} · ${assignment.roleOnJob} · ${assignment.start.toLocaleDateString()}–${assignment.end.toLocaleDateString()}`}
                          className={`absolute top-1.5 bottom-1.5 flex items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white ${
                            conflicted ? 'bg-red-600 ring-2 ring-red-300' : 'bg-zinc-800'
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="truncate">{assignment.job.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
      {workers.length === 0 && <p className="text-sm text-zinc-500">No crew on file.</p>}
    </div>
  );
}

function startOfDay(date: Date): Date {
  const truncated = new Date(date);
  truncated.setHours(0, 0, 0, 0);
  return truncated;
}

function dayOffset(date: Date, windowStart: Date): number {
  const raw = (date.getTime() - windowStart.getTime()) / DAY_MS;
  return Math.min(WINDOW_DAYS, Math.max(0, raw));
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
