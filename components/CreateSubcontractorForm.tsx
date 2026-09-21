'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

/** New-firm entry point for the subcontractor list. License and COI detail
 * are added afterward on the firm's own detail page — this just creates
 * the record. */
export function CreateSubcontractorForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [trade, setTrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!businessName.trim() || !trade.trim()) {
      setError('Enter a business name and trade.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/subcontractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName.trim(), trade: trade.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that firm.');
      }
      setBusinessName('');
      setTrade('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that firm.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New subcontractor firm
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">New subcontractor firm</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-600">
          Business name
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          Trade
          <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Electrical" className="mt-1 w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add firm'}
        </button>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </form>
  );
}
