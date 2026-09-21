'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface AssignWorkerFormProps {
  jobId: string;
  workers: Array<{ id: string; name: string; trade: string }>;
}

/** Assigns an existing worker to this job. A scheduling conflict isn't
 * checked before submit — same as an equipment reservation, it's allowed
 * and then surfaced by the job detail page's own conflict banner once this
 * assignment exists, rather than blocked here (see the API route's
 * comment). A certification gate, if this role's staffing-plan requirement
 * names required certs, IS enforced by the API and shows up as the error
 * below on submit. */
export function AssignWorkerForm({ jobId, workers }: AssignWorkerFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [roleOnJob, setRoleOnJob] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!workerId) {
      setError('Select a worker.');
      return;
    }
    if (!roleOnJob.trim()) {
      setError('Enter the role this assignment is for.');
      return;
    }
    if (!start || !end) {
      setError('Enter both start and end dates.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, roleOnJob: roleOnJob.trim(), start, end }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not create that assignment.');
      }
      setWorkerId('');
      setRoleOnJob('');
      setStart('');
      setEnd('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that assignment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field-btn mt-3 inline-flex w-fit border border-outdoor-border bg-white text-zinc-800 hover:bg-outdoor-surface"
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Assign crew
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[160px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Worker
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            <option value="">Select a worker…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name} — {w.trade}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Role on this job
          <input
            value={roleOnJob}
            onChange={(e) => setRoleOnJob(e.target.value)}
            placeholder="Match a staffing-plan role to gate on its required certs"
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          End
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Assigning…' : 'Assign'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
