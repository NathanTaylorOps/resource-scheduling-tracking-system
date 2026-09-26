import Link from 'next/link';
import { getDb } from '@/lib/db';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import type { ComponentStatus } from '@/lib/domain/readiness';
import { StatusBadge } from '@/components/StatusBadge';
import { CreateSubcontractorForm } from '@/components/CreateSubcontractorForm';

export const dynamic = 'force-dynamic';

export default async function SubcontractorsPage() {
  const prisma = getDb();
  const subcontractors = await prisma.subcontractor.findMany({
    include: { coiRecords: true, workers: true },
    orderBy: { businessName: 'asc' },
  });
  const now = new Date();

  // Computed once per firm and reused by both layouts below.
  const rows = subcontractors.map((sub) => {
    const compliance = evaluateSubcontractorCompliance(
      { licenseExpiryDate: sub.licenseExpiryDate, coiRecords: sub.coiRecords },
      now,
    );
    // Explicitly typed as ComponentStatus: without an annotation, a plain
    // ternary of string literals like this widens to `string`, which
    // compiles fine here but fails at the StatusBadge call below (caught by
    // the typecheck CI step added in this pass -- the plain build/lint
    // steps that ran before it never exercised this path).
    const worst: ComponentStatus = compliance.hasExpiredItem ? 'blocked' : compliance.hasExpiringSoonItem ? 'warning' : 'ok';
    return { sub, worst };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subcontractor firms</h1>
        <p className="text-sm text-zinc-500">
          Entity-level insurance and license standing — the firm&apos;s eligibility to work, tracked separately
          from the individual training records of whoever from the firm is actually on site. See{' '}
          <Link href="/workers" className="underline">
            crew
          </Link>{' '}
          for person-level certifications.
        </p>
      </div>

      <CreateSubcontractorForm />

      {/* Below sm: a table with four columns doesn't fit a phone screen, so
          this is a stacked card list instead of a clipped or sideways-
          scrolling table. */}
      <div className="space-y-3 sm:hidden">
        {rows.map(({ sub, worst }) => (
          <Link key={sub.id} href={`/subcontractors/${sub.id}`} className="card block hover:border-zinc-400">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{sub.businessName}</span>
              <StatusBadge
                status={worst}
                label={worst === 'blocked' ? 'Compliance lapsed' : worst === 'warning' ? 'Review needed' : 'All current'}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {sub.trade} · {sub.workers.length} crew on file
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-sm text-zinc-500">No subcontractor firms on file.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-outdoor-border shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-outdoor-surface text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Crew on file</th>
              <th className="px-4 py-3">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outdoor-border bg-white">
            {rows.map(({ sub, worst }) => (
              <tr key={sub.id} className="hover:bg-outdoor-surface">
                <td className="px-4 py-3">
                  <Link href={`/subcontractors/${sub.id}`} className="font-medium hover:underline">
                    {sub.businessName}
                  </Link>
                </td>
                <td className="px-4 py-3">{sub.trade}</td>
                <td className="px-4 py-3">{sub.workers.length}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={worst}
                    label={worst === 'blocked' ? 'Compliance lapsed' : worst === 'warning' ? 'Review needed' : 'All current'}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No subcontractor firms on file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
