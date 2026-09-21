'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge, certificationBadge } from '@/components/StatusBadge';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { Pencil } from 'lucide-react';

interface SubcontractorLicenseEditorProps {
  subcontractorId: string;
  licenseNumber: string | null;
  licenseClass: string | null;
  licenseIssuingAuthority: string | null;
  licenseExpiryDate: string | null;
}

export function SubcontractorLicenseEditor({
  subcontractorId,
  licenseNumber,
  licenseClass,
  licenseIssuingAuthority,
  licenseExpiryDate,
}: SubcontractorLicenseEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(licenseNumber ?? '');
  const [licClass, setLicClass] = useState(licenseClass ?? '');
  const [authority, setAuthority] = useState(licenseIssuingAuthority ?? '');
  const [expiry, setExpiry] = useState(licenseExpiryDate ? licenseExpiryDate.slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/subcontractors/${subcontractorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseNumber: number.trim(),
          licenseClass: licClass.trim() || undefined,
          licenseIssuingAuthority: authority.trim(),
          licenseExpiryDate: expiry || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not save the license.');
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the license.');
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="License number" aria-label="License number" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
          <input value={licClass} onChange={(e) => setLicClass(e.target.value)} placeholder="Class (optional)" aria-label="License class, optional" className="w-28 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
          <input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Issuing authority" aria-label="Issuing authority" className="min-w-[160px] flex-1 rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="License expiry date" className="rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900">
            Cancel
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </form>
    );
  }

  if (licenseNumber && licenseExpiryDate) {
    const result = getCertificationStatus(new Date(licenseExpiryDate), new Date(), undefined, 'LICENSE_CYCLE');
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <div className="font-medium">{licenseNumber}</div>
          <div className="text-xs text-zinc-500">
            {licenseClass && `${licenseClass} · `}
            {licenseIssuingAuthority} · expires {new Date(licenseExpiryDate).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge {...certificationBadge(result)} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit trade license"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-zinc-500">No trade license on file for this firm.</p>
      <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
        + Add license
      </button>
    </div>
  );
}
