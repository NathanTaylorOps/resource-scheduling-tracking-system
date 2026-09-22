'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface AddScreeningFormProps {
  workerId: string;
}

const SCREENING_TYPE_OPTIONS = [
  { value: 'DRUG_TEST', label: 'Drug test' },
  { value: 'BACKGROUND_CHECK', label: 'Background check' },
];

const RESULT_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'PENDING', label: 'Pending' },
];

/** Records a drug test or background check result on a worker's file —
 * append-only, same as the API route it posts to: a new test is a new row,
 * never an edit to an old one, so the history stays intact. Closely mirrors
 * AddCertificationForm, the existing template for a worker-scoped record
 * form on this page. */
export function AddScreeningForm({ workerId }: AddScreeningFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [screeningType, setScreeningType] = useState('DRUG_TEST');
  const [result, setResult] = useState('PASS');
  const [administeredDate, setAdministeredDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!administeredDate) {
      setError('Enter the administered date.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/workers/${workerId}/screenings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screeningType,
          result,
          administeredDate,
          expiryDate: expiryDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that screening.');
      }
      setScreeningType('DRUG_TEST');
      setResult('PASS');
      setAdministeredDate('');
      setExpiryDate('');
      setNotes('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that screening.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add screening
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[160px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Screening type
          <select
            value={screeningType}
            onChange={(e) => setScreeningType(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          >
            {SCREENING_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[120px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Result
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          >
            {RESULT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Administered
          <input
            type="date"
            value={administeredDate}
            onChange={(e) => setAdministeredDate(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Expires (optional)
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-zinc-600">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add screening'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
