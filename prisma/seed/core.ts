import type { PrismaClient } from '@prisma/client';
import {
  EmploymentType, JobStatus, WeatherSensitivity, EquipmentStatus, CounterType, ComplianceType,
  ScanAction, WorkOrderSource, WorkOrderStatus, PermitType, PermitStatus, InspectionType,
  InspectionStatus, ReinspectionChannel, RenewalPattern, CoverageType, LienWaiverType,
  LienWaiverStatus, IncidentType, IncidentSeverity,
} from '../../lib/enums';
import type { SeedClock } from './clock';

export async function seedCore(prisma: PrismaClient, clock: SeedClock) {
  const { daysFromNow, daysAgo } = clock;
  // ---------------------------------------------------------------------
  // Jobs — four residential builds and one light-commercial buildout,
  // mirroring the scale of a small-mid vertically-integrated GC.
  // ---------------------------------------------------------------------
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        name: 'Cedar Hollow Residence',
        address: '4210 Cedar Hollow Ln, Snohomish, WA',
        latitude: 47.9184,
        longitude: -122.0982,
        status: JobStatus.ACTIVE,
        startDate: daysAgo(45),
        targetEndDate: daysFromNow(120),
        weatherSensitivity: WeatherSensitivity.SENSITIVE,
        division: 'Residential — North Sound',
      },
    }),
    prisma.job.create({
      data: {
        name: 'Harbor Point Remodel',
        address: '118 Harbor Point Dr, Everett, WA',
        latitude: 47.9789,
        longitude: -122.2021,
        status: JobStatus.ACTIVE,
        startDate: daysAgo(20),
        targetEndDate: daysFromNow(60),
        weatherSensitivity: WeatherSensitivity.CONDITIONAL,
        division: 'Residential — North Sound',
      },
    }),
    prisma.job.create({
      data: {
        name: 'Orchard Ridge New Build',
        address: '885 Orchard Ridge Rd, Woodinville, WA',
        latitude: 47.7538,
        longitude: -122.1637,
        status: JobStatus.PLANNING,
        startDate: daysFromNow(14),
        targetEndDate: daysFromNow(280),
        weatherSensitivity: WeatherSensitivity.SENSITIVE,
        division: 'Residential — Eastside',
      },
    }),
    prisma.job.create({
      data: {
        name: 'Maple Crossing Custom Home',
        address: '2290 Maple Crossing Way, Bothell, WA',
        latitude: 47.7623,
        longitude: -122.2054,
        status: JobStatus.ACTIVE,
        startDate: daysAgo(90),
        targetEndDate: daysFromNow(30),
        weatherSensitivity: WeatherSensitivity.CONDITIONAL,
        division: 'Residential — Eastside',
      },
    }),
    // Light-commercial tenant improvement, and the one seeded job bound to
    // Davis-Bacon-style certified payroll reporting — see
    // Job.certifiedPayrollRequired's schema comment for why that's a
    // contract fact, not something inferred from job type generally; it
    // just happens that public-money commercial work is where it shows up
    // in this seed set, not residential.
    prisma.job.create({
      data: {
        name: 'Lakeview Professional Building — Tenant Improvement',
        address: '760 Lakeview Ave, Kirkland, WA',
        latitude: 47.6769,
        longitude: -122.2059,
        status: JobStatus.ON_HOLD,
        startDate: daysAgo(10),
        targetEndDate: daysFromNow(75),
        weatherSensitivity: WeatherSensitivity.INSENSITIVE,
        division: 'Commercial — Eastside',
        certifiedPayrollRequired: true,
      },
    }),
  ]);
  const [cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview] = jobs;

  // ---------------------------------------------------------------------
  // Subcontractor firms — entity-level license and insurance standing,
  // tracked separately from the person-level certifications each firm's own
  // crew members hold (see the long comment on
  // WorkerCertification.renewalPattern in schema.prisma and
  // lib/domain/subcontractors.ts). Deliberately spans all three compliance
  // reads a GM would actually see on the list page: Salvador Electric has a
  // COI coverage expiring soon, Cho Plumbing's trade license has already
  // lapsed even though Renata's own training is current, and Ridgeline is
  // fully current but hasn't been dispatched to a job yet — which is also
  // why it has no individual crew member on file, the natural fit for
  // Orchard Ridge's still-unfilled excavation role below.
  // ---------------------------------------------------------------------
  const salvadorElectric = await prisma.subcontractor.create({
    data: {
      businessName: 'Salvador Electric LLC',
      trade: 'Electrical',
      licenseNumber: 'WA-ELE-88214',
      licenseClass: 'Master Electrician',
      licenseIssuingAuthority: 'Washington State Department of Labor & Industries',
      licenseExpiryDate: daysFromNow(500),
      coiRecords: {
        create: [
          { coverageType: CoverageType.GENERAL_LIABILITY, carrier: 'Pinnacle Mutual', policyNumber: 'GL-4471982', effectiveDate: daysAgo(165), expiryDate: daysFromNow(200), coverageLimit: 2000000, additionalInsured: true },
          { coverageType: CoverageType.WORKERS_COMP, carrier: 'Washington State Fund', policyNumber: 'WC-119834', effectiveDate: daysAgo(165), expiryDate: daysFromNow(200) },
          // Deliberately expiring soon — the COI-coverage-level warning case.
          { coverageType: CoverageType.COMMERCIAL_AUTO, carrier: 'Pinnacle Mutual', policyNumber: 'CA-88214', effectiveDate: daysAgo(340), expiryDate: daysFromNow(25) },
        ],
      },
    },
  });
  const choPlumbing = await prisma.subcontractor.create({
    data: {
      businessName: 'Cho Plumbing & Mechanical Inc.',
      trade: 'Plumbing',
      licenseNumber: 'WA-PLM-55021',
      licenseClass: 'Class A Plumbing Contractor',
      licenseIssuingAuthority: 'Washington State Department of Labor & Industries',
      // Deliberately lapsed — the firm-level blocked-path example. The
      // business's eligibility to work has expired even though Renata's own
      // certifications, tracked separately below, are current.
      licenseExpiryDate: daysAgo(10),
      notes: 'License renewal submitted to L&I — confirmation pending. Hold on dispatching to new jobs until reinstated.',
      coiRecords: {
        create: [
          { coverageType: CoverageType.GENERAL_LIABILITY, carrier: 'Cascade Underwriters', policyNumber: 'GL-33102', effectiveDate: daysAgo(215), expiryDate: daysFromNow(150), coverageLimit: 1000000, additionalInsured: true },
          { coverageType: CoverageType.WORKERS_COMP, carrier: 'Washington State Fund', policyNumber: 'WC-88201', effectiveDate: daysAgo(215), expiryDate: daysFromNow(150) },
        ],
      },
    },
  });
  // No linked worker on purpose — vetted and on file, not yet dispatched.
  await prisma.subcontractor.create({
    data: {
      businessName: 'Ridgeline Excavation & Grading Co.',
      trade: 'Excavation & Grading',
      licenseNumber: 'WA-EXC-30044',
      licenseClass: 'General Engineering Contractor',
      licenseIssuingAuthority: 'Washington State Department of Labor & Industries',
      licenseExpiryDate: daysFromNow(300),
      notes: 'Vetted and on file for Orchard Ridge sitework; not yet dispatched, so no individual crew member is on file until mobilization.',
      coiRecords: {
        create: [
          { coverageType: CoverageType.GENERAL_LIABILITY, carrier: 'Cascade Underwriters', policyNumber: 'GL-77410', effectiveDate: daysAgo(90), expiryDate: daysFromNow(180), coverageLimit: 2000000, additionalInsured: true },
          { coverageType: CoverageType.WORKERS_COMP, carrier: 'Washington State Fund', policyNumber: 'WC-77410', effectiveDate: daysAgo(90), expiryDate: daysFromNow(180) },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Workers — a mix of direct employees and subcontractors, matching a
  // realistic small-mid GC crew composition, plus one owner/GM-adjacent
  // record: a principal who isn't scheduled to jobs the way field crew is,
  // but shows up in the field documentation below the way an owner actually
  // does — periodic site visits, not day-to-day staffing.
  // ---------------------------------------------------------------------
  // Phone uses the 425 area code shared by every job site above (Snohomish
  // County / Eastside) with the 555-01XX exchange NANPA reserves for
  // fictional use, so it reads as a real regional number without being one.
  // Email is only seeded for the office-adjacent roles (ownership, the
  // superintendent, the two PMs) — realistic for a GC this size, where field
  // trade crew get called or texted, not emailed, day to day — on the
  // reserved-for-documentation .example domain (RFC 2606), so it can't
  // collide with a real one either.
  const workers = await Promise.all([
    prisma.worker.create({ data: { name: 'Walt Ferreira', trade: 'Owner / Principal', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(1400), phone: '425-555-0101', email: 'walt.ferreira@coastwoodbuilders.example' } }),
    prisma.worker.create({ data: { name: 'Dale Petrenko', trade: 'Site Superintendent', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(900), phone: '425-555-0102', email: 'dale.petrenko@coastwoodbuilders.example' } }),
    prisma.worker.create({ data: { name: 'Marcus Ibe', trade: 'Carpenter Foreman', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(720), phone: '425-555-0103' } }),
    prisma.worker.create({ data: { name: 'Priya Nandan', trade: 'Carpenter', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(500), phone: '425-555-0104' } }),
    prisma.worker.create({ data: { name: 'Ollie Fenwick', trade: 'Carpenter', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(310), phone: '425-555-0105' } }),
    prisma.worker.create({ data: { name: 'Teo Salvador', trade: 'Electrician', employmentType: EmploymentType.SUBCONTRACTOR, hireDate: daysAgo(600), subcontractorId: salvadorElectric.id, phone: '425-555-0106' } }),
    prisma.worker.create({ data: { name: 'Renata Cho', trade: 'Plumber', employmentType: EmploymentType.SUBCONTRACTOR, hireDate: daysAgo(480), subcontractorId: choPlumbing.id, phone: '425-555-0107' } }),
    prisma.worker.create({ data: { name: 'Big Sam Okonkwo', trade: 'Heavy Equipment Operator', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(650), phone: '425-555-0108' } }),
    prisma.worker.create({ data: { name: 'Jules Whitfield', trade: 'Laborer', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(150), phone: '425-555-0109' } }),
    // Project managers run multiple sites at once rather than living on one
    // job the way a superintendent does — that's why their vehicles, phones,
    // and laptops below are field-assigned equipment (tracked by custody,
    // currentWorkerId) rather than job-site equipment tied to one currentJobId.
    prisma.worker.create({ data: { name: 'Renee Castellanos', trade: 'Project Manager', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(560), phone: '425-555-0110', email: 'renee.castellanos@coastwoodbuilders.example' } }),
    prisma.worker.create({ data: { name: 'Kenji Osei', trade: 'Project Manager', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(410), phone: '425-555-0111', email: 'kenji.osei@coastwoodbuilders.example' } }),
  ]);
  const [walt, dale, marcus, priya, ollie, teo, renata, bigSam, jules, renee, kenji] = workers;

  // Certifications — a deliberate spread across all four renewal patterns
  // (see the schema comment on WorkerCertification.renewalPattern), not just
  // a spread of valid/expiring/expired dates. OSHA 10/30 cards never
  // formally expire, so every one below is INFORMAL_RECENCY rather than the
  // HARD_EXPIRY default — expiryDate on those rows is the informal
  // recommended-refresh-by date, not a real wall. Walt's and Renee's are
  // deliberately past that date to show 'aging' as distinct from 'expired':
  // a real gap, not a hard stop — and a realistic one, since it's usually
  // the owner and the longest-tenured PM whose own paperwork lags behind
  // the field crew's, not the other way around.
  await prisma.workerCertification.createMany({
    data: [
      { workerId: walt.id, certType: 'OSHA 30', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(1500), expiryDate: daysAgo(200), renewalPattern: RenewalPattern.INFORMAL_RECENCY }, // aging
      { workerId: dale.id, certType: 'OSHA 30', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(1000), expiryDate: daysFromNow(400), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
      { workerId: dale.id, certType: 'First Aid / CPR', issuingBody: 'Red Cross', issueDate: daysAgo(700), expiryDate: daysFromNow(20) }, // expiring soon (HARD_EXPIRY default — a real wall)
      { workerId: marcus.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(900), expiryDate: daysFromNow(600), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
      { workerId: marcus.id, certType: 'Confined Space Entry', issuingBody: 'Coastwood Internal Training', issueDate: daysAgo(400), expiryDate: daysAgo(5) }, // expired (HARD_EXPIRY default)
      { workerId: priya.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(500), expiryDate: daysFromNow(550), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
      // Renewal filed within the 90-day window EPA RRP allows — valid past
      // its nominal expiry while the renewal is pending, not expired. Ties
      // to the lead-safe-practices toolbox talk below, which Ollie attended.
      { workerId: ollie.id, certType: 'EPA RRP Certified Renovator', issuingBody: 'EPA Lead-Safe Certification Program', issueDate: daysAgo(1850), expiryDate: daysAgo(20), renewalPattern: RenewalPattern.GRACE_PERIOD, renewalFiledDate: daysAgo(130) },
      // Teo's own trade license, distinct from Salvador Electric's business
      // license tracked on the Subcontractor record above.
      { workerId: teo.id, certType: 'Master Electrician License', issuingBody: 'Washington State Department of Labor & Industries', issueDate: daysAgo(300), expiryDate: daysFromNow(430), renewalPattern: RenewalPattern.LICENSE_CYCLE },
      // Renata's own credential, current — the other half of the Cho
      // Plumbing example above: the firm's business license has lapsed, but
      // that's a firm-level fact, distinct from Renata's personal standing.
      { workerId: renata.id, certType: 'Backflow Prevention Assembly Tester', issuingBody: 'Washington State Department of Health', issueDate: daysAgo(400), expiryDate: daysFromNow(320) },
      { workerId: bigSam.id, certType: 'Forklift Operator', issuingBody: 'Coastwood Internal Training', issueDate: daysAgo(300), expiryDate: daysFromNow(45) },
      { workerId: bigSam.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(800), expiryDate: daysFromNow(700), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
      { workerId: jules.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(120), expiryDate: daysFromNow(1100), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
      { workerId: renee.id, certType: 'OSHA 30', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(1125), expiryDate: daysAgo(30), renewalPattern: RenewalPattern.INFORMAL_RECENCY }, // aging
      { workerId: kenji.id, certType: 'OSHA 30', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(410), expiryDate: daysFromNow(450), renewalPattern: RenewalPattern.INFORMAL_RECENCY },
    ],
  });

  // ---------------------------------------------------------------------
  // Assignments — including one deliberate double-booking so the overlap
  // detector has something real to catch.
  // ---------------------------------------------------------------------
  await prisma.assignment.createMany({
    data: [
      { workerId: dale.id, jobId: cedarHollow.id, roleOnJob: 'Site Superintendent', start: daysAgo(45), end: daysFromNow(120) },
      { workerId: marcus.id, jobId: cedarHollow.id, roleOnJob: 'Carpenter Foreman', start: daysAgo(45), end: daysFromNow(40) },
      { workerId: priya.id, jobId: cedarHollow.id, roleOnJob: 'Carpenter', start: daysAgo(30), end: daysFromNow(40) },
      { workerId: ollie.id, jobId: cedarHollow.id, roleOnJob: 'Carpenter', start: daysFromNow(2), end: daysFromNow(45) },
      // Deliberate conflict: Ollie is also booked on Harbor Point for two of the same days.
      { workerId: ollie.id, jobId: harborPoint.id, roleOnJob: 'Carpenter', start: daysFromNow(1), end: daysFromNow(10) },
      { workerId: teo.id, jobId: harborPoint.id, roleOnJob: 'Electrician', start: daysAgo(15), end: daysFromNow(15) },
      { workerId: renata.id, jobId: mapleCrossing.id, roleOnJob: 'Plumber', start: daysAgo(20), end: daysFromNow(10) },
      { workerId: bigSam.id, jobId: mapleCrossing.id, roleOnJob: 'Heavy Equipment Operator', start: daysAgo(10), end: daysFromNow(5) },
      { workerId: jules.id, jobId: mapleCrossing.id, roleOnJob: 'Laborer', start: daysAgo(30), end: daysFromNow(30) },
      { workerId: renee.id, jobId: cedarHollow.id, roleOnJob: 'Project Manager', start: daysAgo(45), end: daysFromNow(120) },
      { workerId: renee.id, jobId: orchardRidge.id, roleOnJob: 'Project Manager', start: daysFromNow(14), end: daysFromNow(280) },
      { workerId: kenji.id, jobId: harborPoint.id, roleOnJob: 'Project Manager', start: daysAgo(20), end: daysFromNow(60) },
      { workerId: kenji.id, jobId: mapleCrossing.id, roleOnJob: 'Project Manager', start: daysAgo(90), end: daysFromNow(30) },
      { workerId: kenji.id, jobId: lakeview.id, roleOnJob: 'Project Manager', start: daysAgo(10), end: daysFromNow(75) },
    ],
  });

  return { jobs, cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview, salvadorElectric, choPlumbing, workers, walt, dale, marcus, priya, ollie, teo, renata, bigSam, jules, renee, kenji };
}
export type CoreSeed = Awaited<ReturnType<typeof seedCore>>;
