import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getCertificationStatus } from '@/lib/domain/certifications';
import { evaluateSubcontractorCompliance } from '@/lib/domain/subcontractors';
import { calculateUtilization } from '@/lib/domain/scheduling';
import { StatusBadge, certificationBadge } from '@/components/StatusBadge';
import { AddCertificationForm } from '@/components/AddCertificationForm';
import { AddScreeningForm } from '@/components/AddScreeningForm';
import { RoleContextBanner } from '@/components/RoleContextBanner';
import { getViewingActor } from '@/lib/actor';
import { permissionsFor } from '@/lib/role';

export const dynamic = 'force-dynamic';

const SCREENING_TYPE_LABEL: Record<string, string> = {
  DRUG_TEST: 'Drug test',
  BACKGROUND_CHECK: 'Background check',
};

// PASS/FAIL/PENDING mapped onto the shared StatusBadge vocabulary — a
// pending result reads as a heads-up (warning), not a block, since a
// screening still in progress isn't the same fact as one that came back
// failed.
const SCREENING_RESULT_BADGE: Record<string, { status: 'ok' | 'blocked' | 'warning'; label: string }> = {
  PASS: { status: 'ok', label: 'Pass' },
  FAIL: { status: 'blocked', label: 'Fail' },
  PENDING: { status: 'warning', label: 'Pending' },
};

export default async function WorkerDetailPage({ params }: { params: { id: string } }) {
  const prisma = getDb();
  const actor = getViewingActor();
  const perms = permissionsFor(actor.role);
  const worker = await prisma.worker.findUnique({
    where: { id: params.id },
    include: {
      certifications: { orderBy: { expiryDate: 'asc' } },
      screenings: { orderBy: { administeredDate: 'desc' } },
      assignments: { include: { job: true }, orderBy: { start: 'desc' } },
      subcontractor: { include: { coiRecords: { orderBy: { expiryDate: 'asc' } } } },
    },
  });
  if (!worker) notFound();

  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const utilization = calculateUtilization({
    assignments: worker.assignments.map((a) => ({
      id: a.id,
      workerId: a.workerId,
      jobId: a.jobId,
      roleOnJob: a.roleOnJob,
      start: a.start,
      end: a.end,
    })),
    periodStart,
    periodEnd: now,
  });

  const subcontractorCompliance = worker.subcontractor
    ? evaluateSubcontractorCompliance(
        { licenseExpiryDate: worker.subcontractor.licenseExpiryDate, coiRecords: worker.subcontractor.coiRecords },
        now,
      )
    : null;

  return (
    <div className="space-y-6">
      <Link href="/workers" className="text-sm text-zinc-500 hover:underline">
        ← Crew
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{worker.name}</h1>
        <p className="text-sm text-zinc-500">
          {worker.trade} · {worker.employmentType === 'DIRECT_EMPLOYEE' ? 'Direct employee' : 'Subcontractor'} · with
          Coastwood since {worker.hireDate.toLocaleDateString()}
        </p>
        {(worker.phone || worker.email) && (
          <p className="mt-1 text-sm text-zinc-500">
            {worker.phone}
            {worker.phone && worker.email && ' · '}
            {worker.email}
          </p>
        )}
      </div>

      <RoleContextBanner role={actor.role} perms={perms} />

      <div className="card w-fit">
        <div className="text-xs text-zinc-500">Utilization, trailing 30 days</div>
        <div className="text-3xl font-bold">{Math.round(utilization * 100)}%</div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Certifications</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Individual, person-held credentials — training cards, crane/rigging certs, trade licenses this worker
          personally holds. A subcontractor firm&apos;s own insurance and business license are tracked separately,
          below, since those gate the firm&apos;s eligibility to work, not this one person&apos;s.
        </p>
        <ul className="divide-y divide-outdoor-border">
          {worker.certifications.map((cert) => {
            const result = getCertificationStatus(cert.expiryDate, now, undefined, cert.renewalPattern, cert.renewalFiledDate);
            const badge = certificationBadge(result);
            return (
              <li key={cert.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{cert.certType}</div>
                  <div className="text-xs text-zinc-500">
                    {cert.issuingBody} ·{' '}
                    {cert.renewalPattern === 'INFORMAL_RECENCY'
                      ? `recommended refresh by ${cert.expiryDate.toLocaleDateString()}`
                      : `expires ${cert.expiryDate.toLocaleDateString()}`}
                    {cert.renewalPattern === 'GRACE_PERIOD' && cert.renewalFiledDate && (
                      <> · renewal filed {cert.renewalFiledDate.toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </li>
            );
          })}
          {worker.certifications.length === 0 && <p className="py-2 text-sm text-zinc-500">No certifications on file.</p>}
        </ul>
        <AddCertificationForm workerId={worker.id} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Background &amp; drug screening</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Point-in-time drug test and background check results — append-only, since a new test is a new record,
          not an edit to a prior one.
        </p>
        <ul className="divide-y divide-outdoor-border">
          {worker.screenings.map((screening) => {
            const badge = SCREENING_RESULT_BADGE[screening.result] ?? { status: 'warning' as const, label: screening.result };
            return (
              <li key={screening.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{SCREENING_TYPE_LABEL[screening.screeningType] ?? screening.screeningType}</div>
                  <div className="text-xs text-zinc-500">
                    Administered {screening.administeredDate.toLocaleDateString()}
                    {screening.expiryDate && <> · expires {screening.expiryDate.toLocaleDateString()}</>}
                    {screening.notes && <> · {screening.notes}</>}
                  </div>
                </div>
                <StatusBadge status={badge.status} label={badge.label} />
              </li>
            );
          })}
          {worker.screenings.length === 0 && <p className="py-2 text-sm text-zinc-500">No screenings on file.</p>}
        </ul>
        {perms.canEditCompliance && <AddScreeningForm workerId={worker.id} />}
      </div>

      {worker.subcontractor && subcontractorCompliance && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Subcontractor firm</h2>
            <StatusBadge
              status={subcontractorCompliance.hasExpiredItem ? 'blocked' : subcontractorCompliance.hasExpiringSoonItem ? 'warning' : 'ok'}
              label={subcontractorCompliance.hasExpiredItem ? 'Compliance lapsed' : subcontractorCompliance.hasExpiringSoonItem ? 'Review needed' : 'All current'}
            />
          </div>
          <Link href={`/subcontractors/${worker.subcontractor.id}`} className="font-medium hover:underline">
            {worker.subcontractor.businessName}
          </Link>
          <p className="text-xs text-zinc-500">
            {worker.subcontractor.trade}
            {worker.subcontractor.licenseNumber && ` · license ${worker.subcontractor.licenseNumber}`}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {worker.name} is a person on this firm&apos;s crew — the firm&apos;s insurance and license status
            (full detail on its own page) is what actually gates whether it can be dispatched, independent of
            which of its people shows up on a given day.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Assignment history</h2>
        <ul className="divide-y divide-outdoor-border">
          {worker.assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <Link href={`/jobs/${a.job.id}`} className="font-medium hover:underline">
                  {a.job.name}
                </Link>
                <div className="text-xs text-zinc-500">{a.roleOnJob}</div>
              </div>
              <div className="text-xs text-zinc-500">
                {a.start.toLocaleDateString()} – {a.end.toLocaleDateString()}
              </div>
            </li>
          ))}
          {worker.assignments.length === 0 && <p className="py-2 text-sm text-zinc-500">No assignments on file.</p>}
        </ul>
      </div>
    </div>
  );
}
