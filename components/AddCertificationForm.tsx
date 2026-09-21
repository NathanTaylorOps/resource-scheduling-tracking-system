'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface AddCertificationFormProps {
  workerId: string;
}

const RENEWAL_PATTERN_OPTIONS = [
  { value: 'HARD_EXPIRY', label: 'Hard expiry', hint: 'A real wall — expired past the date below is expired, full stop.' },
  { value: 'INFORMAL_RECENCY', label: 'Informal recency', hint: 'Never formally expires (e.g. OSHA 10/30) — aging past the date below is a heads-up, not a hard stop.' },
  { value: 'GRACE_PERIOD', label: 'Grace period', hint: 'A fixed cycle with a filing window — a renewal filed in time keeps this valid while it’s pending.' },
  { value: 'LICENSE_CYCLE', label: 'License cycle', hint: 'A state trade-license clock — behaves like a hard expiry.' },
];

/** Adds a certification to a worker's personal file — the only way, short
 * of Prisma Studio, that a worker created after seeding can hold one at
 * all. Matters beyond record-keeping: the assignment route's certification
 * hard-stop (see its own comment) can only check a cert that's actually on
 * file here. certType is matched against a job role requirement's
 * requiredCertTypes by exact string, the same case-sensitive matching
 * JobRequirementsEditor's own caption already warns about. */
export function AddCertificationForm({ workerId }: AddCertificationFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [certType, setCertType] = useState('');
  const [issuingBody, setIssuingBody] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [renewalPattern, setRenewalPattern] = useState('HARD_EXPIRY');
  const [renewalFiledDate, setRenewalFiledDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!certType.trim() || !issuingBody.trim()) {
      setError('Enter the certification type and issuing body.');
      return;
    }
    if (!issueDate || !expiryDate) {
      setError('Enter both the issue and expiry dates.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/workers/${workerId}/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certType: certType.trim(),
          issuingBody: issuingBody.trim(),
          issueDate,
          expiryDate,
          renewalPattern,
          renewalFiledDate: renewalPattern === 'GRACE_PERIOD' ? renewalFiledDate || undefined : undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that certification.');
      }
      setCertType('');
      setIssuingBody('');
      setIssueDate('');
      setExpiryDate('');
      setRenewalPattern('HARD_EXPIRY');
      setRenewalFiledDate('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that certification.');
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
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add certification
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-outdoor-border pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[160px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Certification type
          <input
            value={certType}
            onChange={(e) => setCertType(e.target.value)}
            placeholder="e.g. OSHA 10, Master Electrician License"
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Issuing body
          <input
            value={issuingBody}
            onChange={(e) => setIssuingBody(e.target.value)}
            placeholder="e.g. Washington State Department of Labor & Industries"
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          Issued
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col text-xs font-medium text-zinc-600">
          {renewalPattern === 'INFORMAL_RECENCY' ? 'Recommended refresh by' : 'Expires'}
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col text-xs font-medium text-zinc-600">
          Renewal pattern
          <select
            value={renewalPattern}
            onChange={(e) => setRenewalPattern(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          >
            {RENEWAL_PATTERN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-zinc-400">
        {RENEWAL_PATTERN_OPTIONS.find((opt) => opt.value === renewalPattern)?.hint}
      </p>
      {renewalPattern === 'GRACE_PERIOD' && (
        <label className="flex max-w-[200px] flex-col text-xs font-medium text-zinc-600">
          Renewal filed on
          <input
            type="date"
            value={renewalFiledDate}
            onChange={(e) => setRenewalFiledDate(e.target.value)}
            className="mt-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm"
          />
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="field-btn bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add certification'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
