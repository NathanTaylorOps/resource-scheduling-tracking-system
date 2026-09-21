'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { compressImageFile } from '@/lib/image';

// Mirrors the ScanAction values in lib/enums.ts. Kept as a local literal
// union rather than importing that shared type so this client bundle has
// no dependency on the database layer at all.
type ScanActionValue = 'CHECK_OUT' | 'CHECK_IN' | 'LOCATION_UPDATE' | 'DEFECT_REPORTED';

const ACTIONS: Array<{ value: ScanActionValue; label: string; helper: string }> = [
  { value: 'CHECK_OUT', label: 'Check out to a job', helper: 'Send this asset to a site and attribute it to whoever is taking it.' },
  { value: 'CHECK_IN', label: 'Check in to the yard', helper: 'Return this asset from a job and release it back to storage.' },
  { value: 'LOCATION_UPDATE', label: 'Update location', helper: 'Record where it sits in the yard without changing custody.' },
  { value: 'DEFECT_REPORTED', label: 'Report a defect', helper: 'Flag a problem, take it out of service, and open a work order.' },
];

interface EquipmentScanFormProps {
  equipmentId: string;
  jobs: Array<{ id: string; name: string }>;
  workers: Array<{ id: string; name: string }>;
}

export function EquipmentScanForm({ equipmentId, jobs, workers }: EquipmentScanFormProps) {
  const router = useRouter();
  const [action, setAction] = useState<ScanActionValue>('CHECK_OUT');
  const [scannedByWorkerId, setScannedByWorkerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'available' | 'unavailable'>('pending');

  // Captured once, in the background, as soon as the scan station opens —
  // this is a point-in-time GPS reading from whatever device is doing the
  // scanning, not continuous asset tracking. That's what a QR-based system
  // can honestly provide without dedicated tracker hardware on every asset,
  // and it's what turns the scan log into a real location history over time
  // rather than just a job-name string.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('available');
      },
      () => setLocationStatus('unavailable'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!scannedByWorkerId) {
      setError('Select who is scanning this asset.');
      return;
    }
    if (action === 'CHECK_OUT' && !jobId) {
      setError('Select the job this asset is going to.');
      return;
    }
    if (action === 'LOCATION_UPDATE' && !locationNote.trim()) {
      setError('Enter where the asset is now.');
      return;
    }
    if (action === 'DEFECT_REPORTED' && !conditionNote.trim()) {
      setError('Describe the defect before reporting it.');
      return;
    }

    setSubmitting(true);
    try {
      const photoDataUrl = photoFile ? await compressImageFile(photoFile) : undefined;

      const response = await fetch(`/api/equipment/${equipmentId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          scannedByWorkerId,
          jobId: action === 'CHECK_OUT' ? jobId : undefined,
          locationNote: locationNote.trim() || undefined,
          conditionNote: conditionNote.trim() || undefined,
          photoDataUrl,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'The scan could not be recorded.');
      }

      router.push(`/equipment/${equipmentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The scan could not be recorded.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">What are you doing with this asset?</legend>
        {ACTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm transition-colors ${
              action === opt.value ? 'border-zinc-900 bg-zinc-50' : 'border-outdoor-border'
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="scan-action"
                value={opt.value}
                checked={action === opt.value}
                onChange={() => setAction(opt.value)}
              />
              {opt.label}
            </span>
            <span className="ml-6 text-xs text-zinc-500">{opt.helper}</span>
          </label>
        ))}
      </fieldset>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="scannedBy">
          Scanned by
        </label>
        <select
          id="scannedBy"
          value={scannedByWorkerId}
          onChange={(event) => setScannedByWorkerId(event.target.value)}
          className="w-full rounded-md border border-outdoor-border px-3 py-2 text-sm"
        >
          <option value="">Select crew member…</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
      </div>

      {action === 'CHECK_OUT' && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="job">
            Job
          </label>
          <select
            id="job"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className="w-full rounded-md border border-outdoor-border px-3 py-2 text-sm"
          >
            <option value="">Select job…</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(action === 'CHECK_IN' || action === 'LOCATION_UPDATE') && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="locationNote">
            {action === 'LOCATION_UPDATE' ? 'Current location' : 'Storage location (optional)'}
          </label>
          <input
            id="locationNote"
            value={locationNote}
            onChange={(event) => setLocationNote(event.target.value)}
            placeholder="e.g. Yard — Bay 3"
            className="w-full rounded-md border border-outdoor-border px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="conditionNote">
          {action === 'DEFECT_REPORTED' ? 'Describe the defect' : 'Condition note (optional)'}
        </label>
        <textarea
          id="conditionNote"
          value={conditionNote}
          onChange={(event) => setConditionNote(event.target.value)}
          rows={3}
          placeholder={
            action === 'DEFECT_REPORTED'
              ? "What's wrong, and how urgent is it?"
              : 'Anything worth flagging on handover'
          }
          className="w-full rounded-md border border-outdoor-border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="photo">
          Photo (optional)
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>

      <p className="text-xs text-zinc-400">
        {locationStatus === 'available' && "This device's location will be recorded with the scan."}
        {locationStatus === 'unavailable' && 'Location unavailable on this device — the scan will still be recorded.'}
        {locationStatus === 'pending' && 'Checking device location…'}
      </p>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="field-btn w-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? 'Recording…' : 'Submit'}
      </button>
    </form>
  );
}
