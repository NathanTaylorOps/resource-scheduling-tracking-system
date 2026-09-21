'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { X } from 'lucide-react';

interface Requirement {
  id: string;
  roleOrTrade: string;
  requiredCount: number;
  requiredCertTypes: string | null;
}

interface JobRequirementsEditorProps {
  jobId: string;
  requirements: Requirement[];
  assignedCountByRole: Record<string, number>;
}

/**
 * The staffing-plan list plus its own add/remove UI, in one client island —
 * this is the plan side of the plan-versus-actual pattern the README
 * describes; who's actually assigned still comes from Assignment records
 * elsewhere and isn't editable here.
 */
export function JobRequirementsEditor({ jobId, requirements, assignedCountByRole }: JobRequirementsEditorProps) {
  const router = useRouter();
  const [roleOrTrade, setRoleOrTrade] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);
  const [requiredCertTypes, setRequiredCertTypes] = useState('');
  const [pending, setPending] = useState<string | null>(null); // 'add' | a requirement id | null
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!roleOrTrade.trim()) {
      setError('Enter a role or trade.');
      return;
    }
    setPending('add');
    try {
      const response = await fetch(`/api/jobs/${jobId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleOrTrade: roleOrTrade.trim(), requiredCount, requiredCertTypes: requiredCertTypes.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Could not add that requirement.');
      }
      setRoleOrTrade('');
      setRequiredCount(1);
      setRequiredCertTypes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that requirement.');
    } finally {
      setPending(null);
    }
  }

  async function handleRemove(reqId: string, label: string) {
    setError(null);
    setPending(reqId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/requirements/${reqId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? `Could not remove ${label}.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not remove ${label}.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-outdoor-border">
        {requirements.map((r) => {
          const assignedCount = assignedCountByRole[r.roleOrTrade] ?? 0;
          const met = assignedCount >= r.requiredCount;
          return (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{r.roleOrTrade}</div>
                <div className="text-xs text-zinc-500">{assignedCount} of {r.requiredCount} assigned</div>
                {r.requiredCertTypes && (
                  <div className="text-xs text-zinc-400">Requires: {r.requiredCertTypes}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={met ? 'ok' : 'warning'} label={met ? 'Filled' : 'Unfilled'} />
                <button
                  type="button"
                  onClick={() => handleRemove(r.id, r.roleOrTrade)}
                  disabled={pending === r.id}
                  aria-label={`Remove ${r.roleOrTrade} requirement`}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
        {requirements.length === 0 && <p className="py-2 text-sm text-zinc-500">No staffing plan set for this job.</p>}
      </ul>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2 border-t border-outdoor-border pt-3">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="req-role">
            Role or trade
          </label>
          <input
            id="req-role"
            value={roleOrTrade}
            onChange={(event) => setRoleOrTrade(event.target.value)}
            placeholder="e.g. Carpenter"
            className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="req-count">
            Count
          </label>
          <input
            id="req-count"
            type="number"
            min={1}
            value={requiredCount}
            onChange={(event) => setRequiredCount(Math.max(1, parseInt(event.target.value, 10) || 1))}
            className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600" htmlFor="req-certs">
            Required certifications (optional)
          </label>
          <input
            id="req-certs"
            value={requiredCertTypes}
            onChange={(event) => setRequiredCertTypes(event.target.value)}
            placeholder="Comma-separated, e.g. OSHA 10, Master Electrician License"
            className="w-full rounded-md border border-outdoor-border px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending === 'add'}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending === 'add' ? 'Adding…' : '+ Add'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <p className="mt-2 text-xs text-zinc-400">
        Required certifications must match a worker&rsquo;s certification type exactly (case-sensitive) to gate an
        assignment — see the worker&rsquo;s certification records for the exact values on file.
      </p>
    </div>
  );
}
