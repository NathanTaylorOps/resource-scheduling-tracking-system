'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Closes out a work order from wherever it's listed. For one tied to a
 * preventive-maintenance plan, the API route behind this button is also
 * where the fixed-grid due date actually advances — this button is a thin
 * trigger, not where any of that logic lives.
 */
export function WorkOrderCompleteButton({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/complete`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'The work order could not be completed.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The work order could not be completed.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleComplete}
        disabled={submitting}
        className="whitespace-nowrap rounded-md border border-outdoor-border px-2.5 py-1 text-xs font-medium hover:bg-outdoor-surface disabled:opacity-50"
      >
        {submitting ? 'Completing…' : 'Mark complete'}
      </button>
      {error && <span className="max-w-[160px] text-right text-xs text-red-700">{error}</span>}
    </div>
  );
}
