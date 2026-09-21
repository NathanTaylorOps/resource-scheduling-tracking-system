'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETE', label: 'Complete' },
];

const SENSITIVITY_OPTIONS = [
  { value: 'INSENSITIVE', label: 'Insensitive' },
  { value: 'CONDITIONAL', label: 'Conditional' },
  { value: 'SENSITIVE', label: 'Sensitive' },
];

/** New-job entry point for the jobs list — collapsed to a button by
 * default, matching the add-forms already used for daily logs and toolbox
 * talks, so a page nobody's actively filling in doesn't carry an open form
 * by default. */
export function CreateJobForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [status, setStatus] = useState('PLANNING');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetEndDate, setTargetEndDate] = useState('');
  const [weatherSensitivity, setWeatherSensitivity] = useState('CONDITIONAL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!name.trim() || !address.trim()) {
      setError('Enter a name and address.');
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Enter numeric coordinates.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Latitude must be between -90 and 90, and longitude between -180 and 180.');
      return;
    }
    if (!targetEndDate) {
      setError('Enter a target completion date.');
      return;
    }
    // Mirrors app/api/jobs/route.ts's own check — catching this here saves
    // a round trip for the common case (picking dates in the wrong order),
    // though the server still enforces it independently.
    if (new Date(targetEndDate).getTime() <= new Date(startDate).getTime()) {
      setError('Target completion date must be after the start date.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          latitude: lat,
          longitude: lng,
          status,
          startDate,
          targetEndDate,
          weatherSensitivity,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not create that job.');
      }
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setTargetEndDate('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that job.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New job
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">New job</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Job name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harbor Point Residence" className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Address
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <div>
        <div className="text-xs font-medium text-zinc-600">
          Coordinates
          <span className="ml-1 font-normal text-zinc-400">— drives both the weather forecast and the map pin; no geocoding is wired in, so look these up by hand (e.g. right-click the address on Google Maps and copy the lat/lng shown).</span>
        </div>
        <div className="mt-1 flex gap-2">
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude, e.g. 47.9184" inputMode="decimal" className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude, e.g. -122.0982" inputMode="decimal" className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block text-xs font-medium text-zinc-600">
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Target completion
          <input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Weather sensitivity
          <select value={weatherSensitivity} onChange={(e) => setWeatherSensitivity(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            {SENSITIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create job'}
        </button>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    </form>
  );
}
