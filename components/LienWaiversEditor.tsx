'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Pencil } from 'lucide-react';

const WAIVER_TYPES = ['CONDITIONAL_PROGRESS', 'UNCONDITIONAL_PROGRESS', 'CONDITIONAL_FINAL', 'UNCONDITIONAL_FINAL'];
const WAIVER_STATUSES = ['PENDING', 'RECEIVED', 'DISPUTED'];

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface LienWaiverData {
  id: string;
  subcontractor: { id: string; businessName: string };
  waiverType: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  amount: number | null;
  status: string;
  receivedDate: string | null;
  notes: string | null;
}

/**
 * A lien waiver's dollar amount is exactly the figure lib/role.ts's
 * canViewFinancials gates (see its doc comment) — a subcontractor or field
 * role sees the waiver exists and its status, never what it's worth.
 */
export function LienWaiversEditor({
  jobId,
  subcontractors,
  waivers,
  canViewFinancials,
}: {
  jobId: string;
  subcontractors: Array<{ id: string; businessName: string }>;
  waivers: LienWaiverData[];
  canViewFinancials: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {waivers.map((w) => (
          <WaiverRow key={w.id} waiver={w} canViewFinancials={canViewFinancials} onChanged={() => router.refresh()} />
        ))}
        {waivers.length === 0 && <p className="py-2 text-sm text-zinc-500">No lien waivers on file for this job.</p>}
      </ul>

      {adding ? (
        <AddWaiverForm
          jobId={jobId}
          subcontractors={subcontractors}
          onDone={() => { setAdding(false); router.refresh(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add lien waiver
        </button>
      )}
    </div>
  );
}

function AddWaiverForm({
  jobId,
  subcontractors,
  onDone,
  onCancel,
}: {
  jobId: string;
  subcontractors: Array<{ id: string; businessName: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [subcontractorId, setSubcontractorId] = useState('');
  const [waiverType, setWaiverType] = useState('CONDITIONAL_PROGRESS');
  const [payPeriodStart, setPayPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [payPeriodEnd, setPayPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subcontractorId) {
      setError('Select a subcontractor.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/lien-waivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontractorId,
          waiverType,
          payPeriodStart,
          payPeriodEnd,
          amount: amount ? Number(amount) : undefined,
          notes: notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not file that waiver.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file that waiver.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={subcontractorId}
          onChange={(e) => setSubcontractorId(e.target.value)}
          aria-label="Subcontractor"
          className="min-w-[160px] flex-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        >
          <option value="">Select subcontractor…</option>
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>{s.businessName}</option>
          ))}
        </select>
        <select value={waiverType} onChange={(e) => setWaiverType(e.target.value)} aria-label="Waiver type" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          {WAIVER_TYPES.map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Pay period start
          <input type="date" value={payPeriodStart} onChange={(e) => setPayPeriodStart(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Pay period end
          <input type="date" value={payPeriodEnd} onChange={(e) => setPayPeriodEnd(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Amount
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Optional"
            className="mt-1 w-28 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Notes"
        className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Filing…' : 'File waiver'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

function statusToBadge(status: string): 'ok' | 'warning' | 'blocked' {
  if (status === 'RECEIVED') return 'ok';
  if (status === 'DISPUTED') return 'blocked';
  return 'warning';
}

function WaiverRow({
  waiver: w,
  canViewFinancials,
  onChanged,
}: {
  waiver: LienWaiverData;
  canViewFinancials: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="py-2">
        <EditWaiverForm waiver={w} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">{w.subcontractor.businessName} · {titleCase(w.waiverType)}</div>
          <div className="text-xs text-zinc-500">
            {new Date(w.payPeriodStart).toLocaleDateString()} – {new Date(w.payPeriodEnd).toLocaleDateString()}
            {canViewFinancials && ` · ${w.amount !== null ? CURRENCY.format(w.amount) : '—'}`}
            {w.receivedDate && ` · received ${new Date(w.receivedDate).toLocaleDateString()}`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={statusToBadge(w.status)} label={titleCase(w.status)} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Update ${w.subcontractor.businessName} lien waiver status`}
            title="Mark received or disputed"
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditWaiverForm({ waiver: w, onDone, onCancel }: { waiver: LienWaiverData; onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState(w.status);
  const [receivedDate, setReceivedDate] = useState(toDateInputValue(w.receivedDate) || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(w.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/lien-waivers/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          receivedDate: status === 'RECEIVED' ? receivedDate : undefined,
          notes: notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not update that waiver.');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that waiver.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 rounded border border-outdoor-border bg-outdoor-surface p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-700">{w.subcontractor.businessName}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Waiver status" className="rounded border border-outdoor-border px-1.5 py-0.5 text-xs">
          {WAIVER_STATUSES.map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
      </div>
      {status === 'RECEIVED' && (
        <label className="flex items-center gap-1">
          Received
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="rounded border border-outdoor-border px-1 py-0.5" />
        </label>
      )}
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        aria-label="Notes"
        className="w-full rounded border border-outdoor-border px-1.5 py-1"
      />
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
