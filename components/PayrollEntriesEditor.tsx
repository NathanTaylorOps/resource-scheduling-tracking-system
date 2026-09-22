'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus } from 'lucide-react';

const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface PayrollEntryData {
  id: string;
  worker: { id: string; name: string };
  weekEnding: string;
  classification: string;
  hoursWorked: number;
  hourlyRate: number | null;
  fringeRate: number | null;
  status: string;
}

/**
 * Only rendered by the parent page when job.certifiedPayrollRequired is
 * true — not gated here, since "does this job even need certified
 * payroll" is a job-level fact, not a per-viewer one.
 *
 * canViewFinancials hides hourlyRate/fringeRate everywhere (list columns
 * and the add form) — lib/role.ts calls out certified payroll rates by
 * name as exactly the figure that field covers.
 */
export function PayrollEntriesEditor({
  jobId,
  crew,
  entries,
  canViewFinancials,
}: {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  entries: PayrollEntryData[];
  canViewFinancials: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} canViewFinancials={canViewFinancials} onChanged={() => router.refresh()} />
        ))}
        {entries.length === 0 && <p className="py-2 text-sm text-zinc-500">No certified payroll entries on file for this job.</p>}
      </ul>

      {adding ? (
        <AddEntryForm
          jobId={jobId}
          crew={crew}
          canViewFinancials={canViewFinancials}
          onDone={() => { setAdding(false); router.refresh(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add entry
        </button>
      )}
    </div>
  );
}

function AddEntryForm({
  jobId,
  crew,
  canViewFinancials,
  onDone,
  onCancel,
}: {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  canViewFinancials: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [workerId, setWorkerId] = useState('');
  const [weekEnding, setWeekEnding] = useState(new Date().toISOString().slice(0, 10));
  const [classification, setClassification] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [fringeRate, setFringeRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!workerId) {
      setError('Select a worker.');
      return;
    }
    if (!classification.trim()) {
      setError('Enter a labor classification.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/payroll-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          weekEnding,
          classification: classification.trim(),
          hoursWorked: Number(hoursWorked),
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
          fringeRate: fringeRate ? Number(fringeRate) : undefined,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('This worker already has an entry for that week.');
        }
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that entry.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that entry.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          aria-label="Worker"
          className="min-w-[140px] flex-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        >
          <option value="">Select worker…</option>
          {crew.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Week ending
          <input type="date" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <input
        value={classification}
        onChange={(e) => setClassification(e.target.value)}
        placeholder="Labor classification"
        aria-label="Labor classification"
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Hours worked
          <input
            type="number"
            min={0}
            step="0.25"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            className="mt-1 w-24 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
        {canViewFinancials && (
          <>
            <label className="flex flex-col text-xs font-medium text-zinc-600">
              Hourly rate
              <input
                type="number"
                min={0}
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-24 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-zinc-600">
              Fringe rate
              <input
                type="number"
                min={0}
                step="0.01"
                value={fringeRate}
                onChange={(e) => setFringeRate(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-24 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
              />
            </label>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add entry'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

function EntryRow({
  entry: e,
  canViewFinancials,
  onChanged,
}: {
  entry: PayrollEntryData;
  canViewFinancials: boolean;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/payroll-entries/${e.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUBMITTED' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not submit that entry.');
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit that entry.');
      setSubmitting(false);
    }
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">{e.worker.name} · {e.classification}</div>
          <div className="text-xs text-zinc-500">
            Week ending {new Date(e.weekEnding).toLocaleDateString()} · {e.hoursWorked} hrs
            {canViewFinancials && e.hourlyRate !== null && ` · ${CURRENCY.format(e.hourlyRate)}/hr`}
            {canViewFinancials && e.fringeRate !== null && ` · ${CURRENCY.format(e.fringeRate)} fringe`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={e.status === 'SUBMITTED' ? 'ok' : 'warning'} label={e.status === 'SUBMITTED' ? 'Submitted' : 'Draft'} />
          {e.status === 'DRAFT' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </li>
  );
}
