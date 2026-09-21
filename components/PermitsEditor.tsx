'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Pencil } from 'lucide-react';

const PERMIT_TYPES = ['BUILDING', 'ELECTRICAL', 'PLUMBING', 'MECHANICAL', 'SEPTIC', 'GRADING', 'FIRE', 'HEALTH'];
const INSPECTION_TYPES = [
  'FOOTING',
  'FOUNDATION',
  'FRAMING',
  'ROUGH_IN_ELECTRICAL',
  'ROUGH_IN_PLUMBING',
  'ROUGH_IN_MECHANICAL',
  'INSULATION',
  'FINAL',
];
const INSPECTION_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'PASSED', 'FAILED'];
const REINSPECTION_CHANNELS = ['IN_PERSON', 'PHONE', 'ONLINE_PORTAL', 'REMOTE_VIDEO'];

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

interface InspectionData {
  id: string;
  inspectionType: string;
  sequence: number;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  inspectorNotes: string | null;
  correctionNotes: string | null;
  correctionResponsible: string | null;
  reinspectionChannel: string | null;
  reinspectionScheduledDate: string | null;
}

interface PermitData {
  id: string;
  permitType: string;
  permitNumber: string | null;
  issuingAuthority: string;
  status: string;
  appliedDate: string;
  issuedDate: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  inspections: InspectionData[];
}

export function PermitsEditor({ jobId, permits }: { jobId: string; permits: PermitData[] }) {
  const router = useRouter();
  const [addingPermit, setAddingPermit] = useState(false);

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {permits.map((p) => (
          <PermitRow key={p.id} permit={p} onChanged={() => router.refresh()} />
        ))}
        {permits.length === 0 && <p className="py-2 text-sm text-zinc-500">No permits filed for this job.</p>}
      </ul>

      {addingPermit ? (
        <AddPermitForm jobId={jobId} onDone={() => { setAddingPermit(false); router.refresh(); }} onCancel={() => setAddingPermit(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAddingPermit(true)}
          className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add permit
        </button>
      )}
    </div>
  );
}

function AddPermitForm({ jobId, onDone, onCancel }: { jobId: string; onDone: () => void; onCancel: () => void }) {
  const [permitType, setPermitType] = useState('BUILDING');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!issuingAuthority.trim()) {
      setError('Enter the issuing authority.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/permits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permitType, issuingAuthority: issuingAuthority.trim(), permitNumber: permitNumber.trim() || undefined, appliedDate }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not file that permit.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file that permit.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <select value={permitType} onChange={(e) => setPermitType(e.target.value)} aria-label="Permit type" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          {PERMIT_TYPES.map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
        <input
          value={issuingAuthority}
          onChange={(e) => setIssuingAuthority(e.target.value)}
          placeholder="Issuing authority"
          aria-label="Issuing authority"
          className="min-w-[160px] flex-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
        <input
          value={permitNumber}
          onChange={(e) => setPermitNumber(e.target.value)}
          placeholder="Permit # (optional)"
          aria-label="Permit number, optional"
          className="w-32 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
        <input
          type="date"
          value={appliedDate}
          onChange={(e) => setAppliedDate(e.target.value)}
          aria-label="Applied date"
          className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Filing…' : 'File permit'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

function PermitRow({ permit: p, onChanged }: { permit: PermitData; onChanged: () => void }) {
  const [addingInspection, setAddingInspection] = useState(false);

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">
            {titleCase(p.permitType)} permit{p.permitNumber ? ` · ${p.permitNumber}` : ''}
          </div>
          <div className="text-xs text-zinc-500">
            {p.issuingAuthority} · applied {new Date(p.appliedDate).toLocaleDateString()}
            {p.issuedDate && ` · issued ${new Date(p.issuedDate).toLocaleDateString()}`}
            {p.expiryDate && ` · expires ${new Date(p.expiryDate).toLocaleDateString()}`}
          </div>
        </div>
        <StatusBadge
          status={p.isExpired ? 'blocked' : p.status === 'APPLIED' ? 'warning' : 'ok'}
          label={p.isExpired ? 'Expired' : titleCase(p.status)}
        />
      </div>

      {p.inspections.length > 0 && (
        <ul className="mt-2 space-y-1 border-l border-outdoor-border pl-3">
          {p.inspections.map((i) => (
            <InspectionRow key={i.id} inspection={i} onChanged={onChanged} />
          ))}
        </ul>
      )}

      {addingInspection ? (
        <AddInspectionForm
          permitId={p.id}
          nextSequence={p.inspections.length + 1}
          onDone={() => { setAddingInspection(false); onChanged(); }}
          onCancel={() => setAddingInspection(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingInspection(true)}
          className="mt-1.5 flex items-center gap-1 pl-3 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Add inspection
        </button>
      )}
    </li>
  );
}

function AddInspectionForm({
  permitId,
  nextSequence,
  onDone,
  onCancel,
}: {
  permitId: string;
  nextSequence: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [inspectionType, setInspectionType] = useState('FOOTING');
  const [sequence, setSequence] = useState(nextSequence);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/permits/${permitId}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionType, sequence }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that inspection.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that inspection.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1.5 ml-3 flex flex-wrap items-center gap-2">
      <select value={inspectionType} onChange={(e) => setInspectionType(e.target.value)} aria-label="Inspection type" className="rounded-md border border-outdoor-border px-2 py-1 text-xs">
        {INSPECTION_TYPES.map((t) => (
          <option key={t} value={t}>{titleCase(t)}</option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        value={sequence}
        onChange={(e) => setSequence(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-14 rounded-md border border-outdoor-border px-2 py-1 text-xs"
        aria-label="Sequence"
      />
      <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
        {submitting ? 'Adding…' : 'Add'}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-900">
        Cancel
      </button>
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </form>
  );
}

function InspectionRow({ inspection: i, onChanged }: { inspection: InspectionData; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="text-xs">
        <InspectionOutcomeForm inspection={i} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="text-xs">
      <div className="flex items-center justify-between">
        <span className="text-zinc-600">{titleCase(i.inspectionType)}</span>
        <div className="flex items-center gap-1.5">
          <span className={i.status === 'FAILED' ? 'font-medium text-red-700' : i.status === 'PASSED' ? 'text-green-700' : 'text-zinc-500'}>
            {i.status === 'SCHEDULED' && i.scheduledDate ? `scheduled ${new Date(i.scheduledDate).toLocaleDateString()}` : titleCase(i.status)}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Update ${titleCase(i.inspectionType)} inspection`}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
      {i.status === 'FAILED' && (i.correctionNotes || i.reinspectionScheduledDate) && (
        <div className="mt-1 rounded border border-red-100 bg-red-50 px-2 py-1.5 text-zinc-600">
          {i.correctionNotes && (
            <div>{i.reinspectionScheduledDate ? 'Correction made' : 'Correction needed'}: {i.correctionNotes}</div>
          )}
          {i.correctionResponsible && <div>Responsible: {i.correctionResponsible}</div>}
          {i.reinspectionScheduledDate && (
            <div>
              Re-inspection {new Date(i.reinspectionScheduledDate).toLocaleDateString()}
              {i.reinspectionChannel && ` · ${titleCase(i.reinspectionChannel)}`}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function InspectionOutcomeForm({ inspection: i, onDone, onCancel }: { inspection: InspectionData; onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState(i.status);
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue(i.scheduledDate));
  const [completedDate, setCompletedDate] = useState(toDateInputValue(i.completedDate));
  const [inspectorNotes, setInspectorNotes] = useState(i.inspectorNotes ?? '');
  const [correctionNotes, setCorrectionNotes] = useState(i.correctionNotes ?? '');
  const [correctionResponsible, setCorrectionResponsible] = useState(i.correctionResponsible ?? '');
  const [reinspectionChannel, setReinspectionChannel] = useState(i.reinspectionChannel ?? 'IN_PERSON');
  const [reinspectionScheduledDate, setReinspectionScheduledDate] = useState(toDateInputValue(i.reinspectionScheduledDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/inspections/${i.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          scheduledDate: scheduledDate || undefined,
          completedDate: completedDate || undefined,
          inspectorNotes: inspectorNotes.trim() || undefined,
          correctionNotes: correctionNotes.trim() || undefined,
          correctionResponsible: correctionResponsible.trim() || undefined,
          reinspectionChannel: status === 'FAILED' ? reinspectionChannel : undefined,
          reinspectionScheduledDate: reinspectionScheduledDate || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not update that inspection.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that inspection.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 rounded border border-outdoor-border bg-outdoor-surface p-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-700">{titleCase(i.inspectionType)}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={`${titleCase(i.inspectionType)} inspection status`} className="rounded border border-outdoor-border px-1.5 py-0.5 text-xs">
          {INSPECTION_STATUSES.map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <label className="flex items-center gap-1">
          Scheduled
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="rounded border border-outdoor-border px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          Completed
          <input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} className="rounded border border-outdoor-border px-1 py-0.5" />
        </label>
      </div>
      <textarea
        value={inspectorNotes}
        onChange={(e) => setInspectorNotes(e.target.value)}
        placeholder="Inspector notes"
        aria-label="Inspector notes"
        rows={2}
        className="w-full rounded border border-outdoor-border px-1.5 py-1"
      />
      {status === 'FAILED' && (
        <div className="space-y-1.5 rounded border border-red-100 bg-red-50 p-1.5">
          <textarea
            value={correctionNotes}
            onChange={(e) => setCorrectionNotes(e.target.value)}
            placeholder="What needs correcting"
            aria-label="What needs correcting"
            rows={2}
            className="w-full rounded border border-outdoor-border px-1.5 py-1"
          />
          <input
            value={correctionResponsible}
            onChange={(e) => setCorrectionResponsible(e.target.value)}
            placeholder="Responsible for the fix"
            aria-label="Responsible for the fix"
            className="w-full rounded border border-outdoor-border px-1.5 py-1"
          />
          <div className="flex flex-wrap gap-1.5">
            <select value={reinspectionChannel} onChange={(e) => setReinspectionChannel(e.target.value)} aria-label="Re-inspection channel" className="rounded border border-outdoor-border px-1.5 py-0.5">
              {REINSPECTION_CHANNELS.map((c) => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              Re-inspection
              <input
                type="date"
                value={reinspectionScheduledDate}
                onChange={(e) => setReinspectionScheduledDate(e.target.value)}
                className="rounded border border-outdoor-border px-1 py-0.5"
              />
            </label>
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-0.5">
        <button type="submit" disabled={submitting} className="rounded bg-zinc-900 px-2.5 py-1 font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </form>
  );
}
