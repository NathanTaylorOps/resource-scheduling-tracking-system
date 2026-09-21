'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface CreateWorkerFormProps {
  subcontractors: Array<{ id: string; businessName: string }>;
}

/** New-worker entry point for the crew list. Collapsed to a button by
 * default, matching the other add-forms in this app. */
export function CreateWorkerForm({ subcontractors }: CreateWorkerFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [employmentType, setEmploymentType] = useState('DIRECT_EMPLOYEE');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !trade.trim()) {
      setError('Enter a name and trade.');
      return;
    }
    if (employmentType === 'SUBCONTRACTOR' && !subcontractorId) {
      setError('Select which subcontractor firm this worker belongs to.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          trade: trade.trim(),
          employmentType,
          hireDate,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          subcontractorId: employmentType === 'SUBCONTRACTOR' ? subcontractorId : undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that worker.');
      }
      setName('');
      setTrade('');
      setPhone('');
      setEmail('');
      setSubcontractorId('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that worker.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New crew member
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">New crew member</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Trade
          <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Carpenter" className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Employment type
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          >
            <option value="DIRECT_EMPLOYEE">Direct employee</option>
            <option value="SUBCONTRACTOR">Subcontractor</option>
          </select>
        </label>
        {employmentType === 'SUBCONTRACTOR' && (
          <label className="block text-xs font-medium text-zinc-600">
            Subcontractor firm
            <select
              value={subcontractorId}
              onChange={(e) => setSubcontractorId(e.target.value)}
              className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
            >
              <option value="">Select a firm…</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>{s.businessName}</option>
              ))}
            </select>
            {subcontractors.length === 0 && (
              <span className="mt-1 block font-normal text-zinc-400">No subcontractor firms on file yet — add one from the Subcontractor firms page first.</span>
            )}
          </label>
        )}
        <label className="block text-xs font-medium text-zinc-600">
          Hire date
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Phone (optional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Email (optional)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add crew member'}
        </button>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </form>
  );
}
