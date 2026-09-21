'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface ToolboxTalkFormProps {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  onSubmitted?: () => void;
}

export function ToolboxTalkForm({ jobId, crew, onSubmitted }: ToolboxTalkFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState('');
  const [conductedBy, setConductedBy] = useState('');
  const [attendees, setAttendees] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAttendee(workerId: string) {
    setAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!topic.trim()) {
      setError('Enter the topic covered.');
      return;
    }
    if (!conductedBy) {
      setError('Select who led the talk.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/safety-meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate, topic: topic.trim(), conductedBy, attendeeWorkerIds: [...attendees] }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not log that talk.');
      }
      setTopic('');
      setAttendees(new Set());
      setOpen(false);
      if (onSubmitted) onSubmitted();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that talk.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Log a toolbox talk
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Date
          <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-1 min-w-[140px] flex-col text-xs font-medium text-zinc-600">
          Topic
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Ladder safety" className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-medium text-zinc-600">
        Led by
        <select value={conductedBy} onChange={(e) => setConductedBy(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          <option value="">Select crew member…</option>
          {crew.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-zinc-600">Attendees</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {crew.map((w) => (
            <label key={w.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={attendees.has(w.id)} onChange={() => toggleAttendee(w.id)} />
              {w.name}
            </label>
          ))}
          {crew.length === 0 && <p className="text-xs text-zinc-500">No crew assigned to this job yet.</p>}
        </div>
      </fieldset>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn flex-1 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Log talk'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
