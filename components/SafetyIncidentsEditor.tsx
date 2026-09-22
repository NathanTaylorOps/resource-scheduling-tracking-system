'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus } from 'lucide-react';

const INCIDENT_TYPES = ['NEAR_MISS', 'INJURY', 'PROPERTY_DAMAGE', 'ENVIRONMENTAL'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Same severity-color convention as equipment/certification treatments
// elsewhere in the app (see app/equipment/page.tsx's COMPLIANCE_LABEL) —
// HIGH reads as a hard stop, MEDIUM as a heads-up, LOW as informational.
const SEVERITY_CLASS: Record<string, string> = {
  HIGH: 'font-medium text-red-700',
  MEDIUM: 'font-medium text-amber-700',
  LOW: 'text-zinc-500',
};

interface IncidentData {
  id: string;
  incidentType: string;
  severity: string;
  occurredAt: string;
  description: string;
  correctionAction: string | null;
  status: string;
  reportedByWorker: { id: string; name: string } | null;
  involvedWorker: { id: string; name: string } | null;
}

/**
 * canManageSafety gates the add-form and the close action, not the list
 * itself — every role can see what's on file for a job, only the roles
 * lib/role.ts marks canManageSafety can log a new one or close it out.
 */
export function SafetyIncidentsEditor({
  jobId,
  crew,
  incidents,
  canManageSafety,
}: {
  jobId: string;
  crew: Array<{ id: string; name: string }>;
  incidents: IncidentData[];
  canManageSafety: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {incidents.map((i) => (
          <IncidentRow key={i.id} incident={i} canManageSafety={canManageSafety} onChanged={() => router.refresh()} />
        ))}
        {incidents.length === 0 && <p className="py-2 text-sm text-zinc-500">No safety incidents logged for this job.</p>}
      </ul>

      {canManageSafety && (
        adding ? (
          <AddIncidentForm jobId={jobId} crew={crew} onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Log incident
          </button>
        )
      )}
    </div>
  );
}

function AddIncidentForm({
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
  const [incidentType, setIncidentType] = useState('NEAR_MISS');
  const [severity, setSeverity] = useState('LOW');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [correctionAction, setCorrectionAction] = useState('');
  const [reportedByWorkerId, setReportedByWorkerId] = useState('');
  const [involvedWorkerId, setInvolvedWorkerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError('Describe what happened.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/safety-incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentType,
          severity,
          occurredAt: new Date(occurredAt).toISOString(),
          description: description.trim(),
          correctionAction: correctionAction.trim() || undefined,
          reportedByWorkerId: reportedByWorkerId || undefined,
          involvedWorkerId: involvedWorkerId || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not log that incident.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that incident.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} aria-label="Incident type" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          {INCIDENT_TYPES.map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          aria-label="Occurred at"
          className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What happened"
        aria-label="Description"
        rows={2}
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <textarea
        value={correctionAction}
        onChange={(e) => setCorrectionAction(e.target.value)}
        placeholder="Correction action (optional)"
        aria-label="Correction action"
        rows={2}
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 min-w-[140px] flex-col text-xs font-medium text-zinc-600">
          Reported by
          <select value={reportedByWorkerId} onChange={(e) => setReportedByWorkerId(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            <option value="">Optional…</option>
            {crew.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[140px] flex-col text-xs font-medium text-zinc-600">
          Worker involved
          <select value={involvedWorkerId} onChange={(e) => setInvolvedWorkerId(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
            <option value="">Optional…</option>
            {crew.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Logging…' : 'Log incident'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

function IncidentRow({
  incident: i,
  canManageSafety,
  onChanged,
}: {
  incident: IncidentData;
  canManageSafety: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="py-2">
        <CloseIncidentForm incident={i} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            {titleCase(i.incidentType)} · <span className={SEVERITY_CLASS[i.severity] ?? 'text-zinc-500'}>{titleCase(i.severity)}</span>
          </div>
          <div className="text-xs text-zinc-500">{new Date(i.occurredAt).toLocaleString()}</div>
          <p className="mt-1 text-sm text-zinc-700">{i.description}</p>
          {i.correctionAction && <p className="mt-1 text-xs text-zinc-500">Correction: {i.correctionAction}</p>}
          {(i.reportedByWorker || i.involvedWorker) && (
            <div className="mt-1 text-xs text-zinc-400">
              {i.reportedByWorker && `Reported by ${i.reportedByWorker.name}`}
              {i.reportedByWorker && i.involvedWorker && ' · '}
              {i.involvedWorker && `Involved: ${i.involvedWorker.name}`}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={i.status === 'OPEN' ? 'warning' : 'ok'} label={titleCase(i.status)} />
          {canManageSafety && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {i.status === 'OPEN' ? 'Close' : 'Reopen'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function CloseIncidentForm({ incident: i, onDone, onCancel }: { incident: IncidentData; onDone: () => void; onCancel: () => void }) {
  const nextStatus = i.status === 'OPEN' ? 'CLOSED' : 'OPEN';
  const [correctionAction, setCorrectionAction] = useState(i.correctionAction ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/safety-incidents/${i.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, correctionAction: correctionAction.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not update that incident.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that incident.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 rounded border border-outdoor-border bg-outdoor-surface p-2 text-xs">
      <div className="font-medium text-zinc-700">
        {titleCase(i.incidentType)} — mark {titleCase(nextStatus)}
      </div>
      {nextStatus === 'CLOSED' && (
        <textarea
          value={correctionAction}
          onChange={(e) => setCorrectionAction(e.target.value)}
          placeholder="Correction action taken"
          aria-label="Correction action taken"
          rows={2}
          className="w-full rounded border border-outdoor-border px-1.5 py-1"
        />
      )}
      <div className="flex gap-2 pt-0.5">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
