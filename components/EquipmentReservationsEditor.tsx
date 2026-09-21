'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';

interface Reservation {
  id: string;
  job: { id: string; name: string };
  start: string;
  end: string;
}

interface EquipmentReservationsEditorProps {
  equipmentId: string;
  reservations: Reservation[];
  conflictedReservationIds: string[];
  jobs: Array<{ id: string; name: string }>;
}

export function EquipmentReservationsEditor({
  equipmentId,
  reservations,
  conflictedReservationIds,
  jobs,
}: EquipmentReservationsEditorProps) {
  const router = useRouter();
  const conflicted = new Set(conflictedReservationIds);
  const [jobId, setJobId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!jobId || !start || !end) {
      setError('Select a job and both dates.');
      return;
    }
    // Mirrors the API route's own check — saves a round trip for the
    // common case of picking the dates in the wrong order.
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      setError('End date must be after the start date.');
      return;
    }
    setPending('add');
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, start, end }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not book that reservation.');
      }
      setJobId('');
      setStart('');
      setEnd('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book that reservation.');
    } finally {
      setPending(null);
    }
  }

  async function handleCancel(resId: string, jobName: string) {
    setError(null);
    setPending(resId);
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/reservations/${resId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? `Could not cancel the ${jobName} booking.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not cancel the ${jobName} booking.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {reservations.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <div>
              <Link href={`/jobs/${r.job.id}`} className="font-medium hover:underline">
                {r.job.name}
              </Link>
              <div className="text-xs text-zinc-500">
                {new Date(r.start).toLocaleDateString()} – {new Date(r.end).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conflicted.has(r.id) && <span className="text-xs font-medium text-red-700">Double-booked</span>}
              <button
                type="button"
                onClick={() => handleCancel(r.id, r.job.name)}
                disabled={pending === r.id}
                aria-label={`Cancel the ${r.job.name} reservation`}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {reservations.length === 0 && <p className="py-2 text-sm text-zinc-500">No forward bookings for this asset.</p>}
      </ul>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2 border-t border-outdoor-border pt-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="res-job">
            Job
          </label>
          <select
            id="res-job"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          >
            <option value="">Select job…</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="res-start">
            Start
          </label>
          <input
            id="res-start"
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="res-end">
            End
          </label>
          <input
            id="res-end"
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending === 'add'}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending === 'add' ? 'Booking…' : '+ Reserve'}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
