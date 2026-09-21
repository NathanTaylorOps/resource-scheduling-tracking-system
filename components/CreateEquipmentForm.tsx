'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IDLE', label: 'Idle' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DOWN_FOR_SERVICE', label: 'Down for service' },
  { value: 'RETIRED', label: 'Retired' },
];

/** New-asset entry point for the equipment list. The QR tag itself isn't
 * entered here — the API assigns the next CW-EQ-#### number, the same way
 * a real yard issues asset tags rather than letting intake invent one. */
export function CreateEquipmentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [inServiceDate, setInServiceDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !category.trim()) {
      setError('Enter a name and category.');
      return;
    }
    if (!acquisitionDate || !inServiceDate) {
      setError('Enter both dates.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), status, acquisitionDate, inServiceDate }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that asset.');
      }
      setName('');
      setCategory('');
      setAcquisitionDate('');
      setInServiceDate('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that asset.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field-btn inline-flex w-fit bg-zinc-900 text-white hover:bg-zinc-800"
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New asset
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">New asset</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      <p className="text-xs text-zinc-500">A QR tag number is assigned automatically once this is saved.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Asset name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mini Excavator #4" className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Category
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Heavy equipment" className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <div /> {/* keeps the two date fields below aligned to the grid rather than trailing the status field */}
        <label className="block text-xs font-medium text-zinc-600">
          Acquisition date
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          In-service date
          <input type="date" value={inServiceDate} onChange={(e) => setInServiceDate(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add asset'}
        </button>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </form>
  );
}
