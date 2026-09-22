'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface JhaData {
  id: string;
  taskDescription: string;
  hazardsIdentified: string;
  controlMeasures: string;
  reviewDate: string;
  preparedByWorker: { id: string; name: string } | null;
}

/**
 * No status, no edit — a JHA is filed once for a task and superseded by
 * filing a new one if the task or its hazards change (see the POST
 * route's own comment). This is a running list, newest first, plus the
 * add form; canManageSafety gates the form only, matching
 * SafetyIncidentsEditor's read-for-everyone / write-for-some split.
 */
export function HazardAnalysesEditor({
  jobId,
  crew,
  analyses,
  canManageSafety,
}: {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  analyses: JhaData[];
  canManageSafety: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {analyses.map((jha) => (
          <li key={jha.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{jha.taskDescription}</span>
              <span className="text-xs text-zinc-500">Review {new Date(jha.reviewDate).toLocaleDateString()}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-700">
              <span className="font-medium text-zinc-500">Hazards: </span>
              {jha.hazardsIdentified}
            </div>
            <div className="mt-1 text-sm text-zinc-700">
              <span className="font-medium text-zinc-500">Controls: </span>
              {jha.controlMeasures}
            </div>
            {jha.preparedByWorker && (
              <div className="mt-1 text-xs text-zinc-400">Prepared by {jha.preparedByWorker.name}</div>
            )}
          </li>
        ))}
        {analyses.length === 0 && <p className="py-2 text-sm text-zinc-500">No job hazard analyses filed for this job.</p>}
      </ul>

      {canManageSafety && (
        adding ? (
          <AddJhaForm jobId={jobId} crew={crew} onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add JHA
          </button>
        )
      )}
    </div>
  );
}

function AddJhaForm({
  jobId,
  crew,
  onDone,
  onCancel,
}: {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [taskDescription, setTaskDescription] = useState('');
  const [hazardsIdentified, setHazardsIdentified] = useState('');
  const [controlMeasures, setControlMeasures] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [preparedByWorkerId, setPreparedByWorkerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!taskDescription.trim() || !hazardsIdentified.trim() || !controlMeasures.trim()) {
      setError('Fill in the task, hazards, and control measures.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/hazard-analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription: taskDescription.trim(),
          hazardsIdentified: hazardsIdentified.trim(),
          controlMeasures: controlMeasures.trim(),
          reviewDate,
          preparedByWorkerId: preparedByWorkerId || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not file that JHA.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file that JHA.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <input
        value={taskDescription}
        onChange={(e) => setTaskDescription(e.target.value)}
        placeholder="Task description"
        aria-label="Task description"
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <textarea
        value={hazardsIdentified}
        onChange={(e) => setHazardsIdentified(e.target.value)}
        placeholder="Hazards identified"
        aria-label="Hazards identified"
        rows={2}
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <textarea
        value={controlMeasures}
        onChange={(e) => setControlMeasures(e.target.value)}
        placeholder="Control measures"
        aria-label="Control measures"
        rows={2}
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Review date
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-1 min-w-[140px] flex-col text-xs font-medium text-zinc-600">
          Prepared by
          <select value={preparedByWorkerId} onChange={(e) => setPreparedByWorkerId(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            <option value="">Optional…</option>
            {crew.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Filing…' : 'File JHA'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
