'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';

interface ExistingDailyLog {
  id: string;
  logDate: string;
  weatherSummary: string | null;
  crewCount: number;
  workPerformed: string;
  delaysNotes: string | null;
  submittedBy: string | null;
}

interface DailyLogFormProps {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  /** When set, this job already has a log for today — the form opens pre-filled and PATCHes that record instead of creating a new one, since DailyLog's one-per-job-per-day constraint means a second POST for today would just 409. */
  existingLog?: ExistingDailyLog | null;
  /** Called after a successful submit — the foreman view uses this to collapse back to a confirmation instead of a full page refresh. */
  onSubmitted?: () => void;
}

export function DailyLogForm({ jobId, crew, existingLog, onSubmitted }: DailyLogFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logDate, setLogDate] = useState(existingLog ? existingLog.logDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [weatherSummary, setWeatherSummary] = useState(existingLog?.weatherSummary ?? '');
  const [crewCount, setCrewCount] = useState(existingLog?.crewCount ?? (crew.length || 1));
  const [workPerformed, setWorkPerformed] = useState(existingLog?.workPerformed ?? '');
  const [delaysNotes, setDelaysNotes] = useState(existingLog?.delaysNotes ?? '');
  const [submittedBy, setSubmittedBy] = useState(existingLog?.submittedBy ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!workPerformed.trim()) {
      setError('Describe the work performed.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        existingLog ? `/api/jobs/${jobId}/daily-logs/${existingLog.id}` : `/api/jobs/${jobId}/daily-logs`,
        {
          method: existingLog ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logDate,
            weatherSummary: weatherSummary.trim() || undefined,
            crewCount,
            workPerformed: workPerformed.trim(),
            delaysNotes: delaysNotes.trim() || undefined,
            submittedBy: submittedBy || undefined,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not save that log.');
      }
      if (!existingLog) {
        setWorkPerformed('');
        setDelaysNotes('');
        setWeatherSummary('');
      }
      setOpen(false);
      if (onSubmitted) onSubmitted();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that log.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field-btn mt-3 w-full border border-outdoor-border bg-white text-zinc-800 hover:bg-outdoor-surface"
      >
        {existingLog ? (
          <>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" /> Edit today&rsquo;s log
          </>
        ) : (
          <>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Log today
          </>
        )}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Date
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            disabled={!!existingLog}
            title={existingLog ? "The date can't be changed once a log is submitted." : undefined}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Crew on site
          <input
            type="number"
            min={0}
            value={crewCount}
            onChange={(e) => setCrewCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="mt-1 w-24 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-1 min-w-[140px] flex-col text-xs font-medium text-zinc-600">
          Weather (optional)
          <input value={weatherSummary} onChange={(e) => setWeatherSummary(e.target.value)} placeholder="e.g. Clear, 62°F" className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-medium text-zinc-600">
        Work performed
        <textarea
          value={workPerformed}
          onChange={(e) => setWorkPerformed(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Delays (optional)
        <textarea
          value={delaysNotes}
          onChange={(e) => setDelaysNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Logged by
        <select value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          <option value="">Select crew member…</option>
          {crew.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn flex-1 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Saving…' : existingLog ? 'Update log' : 'Submit log'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
