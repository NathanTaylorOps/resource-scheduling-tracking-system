'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

const COVERAGE_TYPES = ['GENERAL_LIABILITY', 'WORKERS_COMP', 'COMMERCIAL_AUTO', 'UMBRELLA', 'PROFESSIONAL_LIABILITY'];

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AddCoiForm({ subcontractorId }: { subcontractorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [coverageType, setCoverageType] = useState('GENERAL_LIABILITY');
  const [carrier, setCarrier] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [coverageLimit, setCoverageLimit] = useState('');
  const [additionalInsured, setAdditionalInsured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!carrier.trim() || !policyNumber.trim() || !expiryDate) {
      setError('Enter the carrier, policy number, and expiry date.');
      return;
    }
    // Mirrors the API route's own check — saves a round trip for the
    // common case of picking the dates in the wrong order.
    if (new Date(expiryDate).getTime() <= new Date(effectiveDate).getTime()) {
      setError('Expiry date must be after the effective date.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/subcontractors/${subcontractorId}/coi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverageType,
          carrier: carrier.trim(),
          policyNumber: policyNumber.trim(),
          effectiveDate,
          expiryDate,
          coverageLimit: coverageLimit ? Number(coverageLimit) : undefined,
          additionalInsured,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that COI record.');
      }
      setCarrier('');
      setPolicyNumber('');
      setExpiryDate('');
      setCoverageLimit('');
      setAdditionalInsured(false);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that COI record.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1 border-t border-outdoor-border pt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add COI record
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} aria-label="Coverage type" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm">
          {COVERAGE_TYPES.map((t) => (
            <option key={t} value={t}>{titleCase(t)}</option>
          ))}
        </select>
        <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" aria-label="Carrier" className="min-w-[120px] flex-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy #" aria-label="Policy number" className="w-32 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-zinc-600">
          Effective
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="rounded-md border border-outdoor-border px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-600">
          Expires
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="rounded-md border border-outdoor-border px-2 py-1 text-sm" />
        </label>
        <input
          type="number"
          value={coverageLimit}
          onChange={(e) => setCoverageLimit(e.target.value)}
          placeholder="Coverage limit ($, optional)"
          aria-label="Coverage limit in dollars, optional"
          className="w-40 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={additionalInsured} onChange={(e) => setAdditionalInsured(e.target.checked)} />
          Coastwood named additional insured
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add record'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
