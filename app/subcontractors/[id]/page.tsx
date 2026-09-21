import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { StatusBadge, certificationBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function SubcontractorDetailPage({ params }: { params: { id: string } }) {
  const subcontractor = await prisma.subcontractor.findUnique({
    where: { id: params.id },
    include: {
      coiRecords: { orderBy: { expiryDate: 'asc' } },
      workers: { include: { assignments: { include: { job: true }, orderBy: { start: 'desc' } } } },
    },
  });
  if (!subcontractor) notFound();

  const now = new Date();
  const compliance = evaluateSubcontractorCompliance(
    { licenseExpiryDate: subcontractor.licenseExpiryDate, coiRecords: subcontractor.coiRecords },
    now,
  );

  const licenseResult = subcontractor.licenseExpiryDate
    ? getCertificationStatus(subcontractor.licenseExpiryDate, now, undefined, 'LICENSE_CYCLE')
    : null;

  return (
    <div className="space-y-6">
      <Link href="/subcontractors" className="text-sm text-zinc-500 hover:underline">
        ← Subcontractor firms
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{subcontractor.businessName}</h1>
          <p className="text-sm text-zinc-500">{subcontractor.trade}</p>
        </div>
        <StatusBadge
          status={compliance.hasExpiredItem ? 'blocked' : compliance.hasExpiringSoonItem ? 'warning' : 'ok'}
          label={compliance.hasExpiredItem ? 'Compliance lapsed' : compliance.hasExpiringSoonItem ? 'Review needed' : 'All current'}
        />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Trade license</h2>
        {subcontractor.licenseNumber && licenseResult ? (
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium">{subcontractor.licenseNumber}</div>
              <div className="text-xs text-zinc-500">
                {subcontractor.licenseClass && `${subcontractor.licenseClass} · `}
                {subcontractor.licenseIssuingAuthority} · expires{' '}
                {subcontractor.licenseExpiryDate?.toLocaleDateString()}
              </div>
            </div>
            <StatusBadge {...certificationBadge(licenseResult)} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No trade license on file for this firm.</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Certificate of insurance</h2>
        <ul className="divide-y divide-outdoor-border">
          {subcontractor.coiRecords.map((coi) => {
            const result = getCertificationStatus(coi.expiryDate, now, undefined, 'HARD_EXPIRY');
            const badge = certificationBadge(result);
            return (
              <li key={coi.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{coi.coverageType.replace(/_/g, ' ').toLowerCase()}</div>
                  <div className="text-xs text-zinc-500">
                    {coi.carrier} · policy {coi.policyNumber} · expires {coi.expiryDate.toLocaleDateString()}
                    {coi.coverageLimit && ` · $${coi.coverageLimit.toLocaleString()} limit`}
                    {coi.additionalInsured && ' · Coastwood named additional insured'}
                  </div>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </li>
            );
          })}
          {subcontractor.coiRecords.length === 0 && <p className="py-2 text-sm text-zinc-500">No COI records on file.</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Crew on this firm</h2>
        <ul className="divide-y divide-outdoor-border">
          {subcontractor.workers.map((worker) => (
            <li key={worker.id} className="py-2">
              <Link href={`/workers/${worker.id}`} className="font-medium hover:underline">
                {worker.name}
              </Link>
              <div className="text-xs text-zinc-500">
                {worker.assignments.length > 0
                  ? `Most recently on ${worker.assignments[0].job.name}`
                  : 'No assignments on file'}
              </div>
            </li>
          ))}
          {subcontractor.workers.length === 0 && (
            <p className="py-2 text-sm text-zinc-500">No individual workers on file for this firm yet.</p>
          )}
        </ul>
      </div>

      {subcontractor.notes && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Notes</h2>
          <p className="text-sm text-zinc-700">{subcontractor.notes}</p>
        </div>
      )}
    </div>
  );
}
