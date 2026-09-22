/**
 * Seed data for Coastwood Builders, a fictional vertically-integrated
 * custom-home GC operating in the Pacific Northwest — every name, address,
 * and figure below is invented for this demo and does not describe any
 * real company, project, or person.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import {
  EmploymentType,
  JobStatus,
  WeatherSensitivity,
  EquipmentStatus,
  CounterType,
  ComplianceType,
  ScanAction,
  WorkOrderSource,
  WorkOrderStatus,
  PermitType,
  PermitStatus,
  InspectionType,
  InspectionStatus,
  ReinspectionChannel,
  RenewalPattern,
  CoverageType,
  LienWaiverType,
  LienWaiverStatus,
  IncidentType,
  IncidentSeverity,
} from '../lib/enums';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * DAY);
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

async function main() {
  console.log('Seeding Coastwood Builders demo data...');

  await prisma.certifiedPayrollEntry.deleteMany();
  await prisma.jobHazardAnalysis.deleteMany();
  await prisma.safetyIncident.deleteMany();
  await prisma.lienWaiver.deleteMany();
  await prisma.scanPhoto.deleteMany();
  await prisma.scanEvent.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.equipmentCompliance.deleteMany();
  await prisma.equipmentLifeCounter.deleteMany();
  await prisma.equipmentReservation.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.workerCertification.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.safetyMeetingAttendee.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.safetyMeeting.deleteMany();
  await prisma.jobRoleRequirement.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.weatherCache.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.subcontractorCOI.deleteMany();
  await prisma.subcontractor.deleteMany();
  await prisma.job.deleteMany();

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

  // ---------------------------------------------------------------------
  // Equipment — spanning the categories a custom-home GC actually owns,
  // each with QR identity and at least one life counter.
  // ---------------------------------------------------------------------
  const excavator = await prisma.equipment.create({
    data: {
      name: 'Mini Excavator — Unit 3',
      category: 'Heavy Equipment',
      qrCode: 'CW-EQ-0003',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(800),
      inServiceDate: daysAgo(795),
      currentJobId: mapleCrossing.id,
      lifeCounters: { create: [{ counterType: CounterType.RUN_HOURS, currentValue: 1180 }] },
    },
  });

  const generator = await prisma.equipment.create({
    data: {
      name: 'Portable Generator — 7kW, Unit 1',
      category: 'Power Equipment',
      qrCode: 'CW-EQ-0011',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(500),
      inServiceDate: daysAgo(495),
      currentJobId: cedarHollow.id,
      lifeCounters: {
        create: [
          { counterType: CounterType.RUN_HOURS, currentValue: 340 },
          { counterType: CounterType.CALENDAR_DAYS, currentValue: 495 },
        ],
      },
    },
  });

  const harness = await prisma.equipment.create({
    data: {
      name: 'Fall-Arrest Harness — H-14',
      category: 'Safety Equipment',
      qrCode: 'CW-EQ-0014',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(200),
      inServiceDate: daysAgo(195),
      currentJobId: cedarHollow.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 195 }] },
    },
  });

  const compressor = await prisma.equipment.create({
    data: {
      name: 'Air Compressor — Unit 2',
      category: 'Power Equipment',
      qrCode: 'CW-EQ-0007',
      status: EquipmentStatus.DOWN_FOR_SERVICE,
      acquisitionDate: daysAgo(650),
      inServiceDate: daysAgo(645),
      locationNote: 'Yard — Bay 2 (awaiting repair)',
      lifeCounters: { create: [{ counterType: CounterType.RUN_HOURS, currentValue: 890 }] },
    },
  });

  const trailer = await prisma.equipment.create({
    data: {
      name: 'Equipment Trailer — T-2',
      category: 'Vehicles & Trailers',
      qrCode: 'CW-EQ-0002',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(1100),
      inServiceDate: daysAgo(1095),
      currentJobId: harborPoint.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 1095 }] },
    },
  });

  const scaffold = await prisma.equipment.create({
    data: {
      name: 'Scaffold Tower Set — S-4',
      category: 'Access Equipment',
      qrCode: 'CW-EQ-0018',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(400),
      inServiceDate: daysAgo(395),
      currentJobId: orchardRidge.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 395 }] },
    },
  });

  // ---------------------------------------------------------------------
  // Equipment — expanded fleet reflecting what actually rides to a
  // Coastwood site day to day: battery and pneumatic trade tools, layout
  // and reality-capture gear, a broader earthmoving line (the same
  // machines that do site grading also do pond excavation and liner-bed
  // compaction — there's no separate "pond" equipment category, just the
  // same iron doing both jobs), and the vehicles/phones/laptops carried
  // by PMs running more than one site at once.
  // ---------------------------------------------------------------------

  // Battery-powered trade tools — tracked as crew kits (drill/driver,
  // impact driver, circular saw, recip saw in a rolling case) rather than
  // individually. That's both how they're actually issued in the field
  // and the reason they're worth QR-tagging at all: a loose battery tool
  // walks off a site far more easily than the kit case it usually lives in.
  const batteryKit1 = await prisma.equipment.create({
    data: {
      name: 'Battery Tool Kit — Crew 1',
      category: 'Battery-Powered Tools',
      qrCode: 'CW-EQ-0019',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(260),
      inServiceDate: daysAgo(255),
      currentJobId: cedarHollow.id,
      currentWorkerId: marcus.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 255 }] },
    },
  });
  const batteryKit2 = await prisma.equipment.create({
    data: {
      name: 'Battery Tool Kit — Crew 2',
      category: 'Battery-Powered Tools',
      qrCode: 'CW-EQ-0020',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(150),
      inServiceDate: daysAgo(145),
      currentJobId: mapleCrossing.id,
      currentWorkerId: jules.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 145 }] },
    },
  });

  // Pneumatic tools run off the yard's air compressors — framing and
  // finish nailers are tracked as sets for the same reason the battery
  // kits are.
  const pneumaticFraming = await prisma.equipment.create({
    data: {
      name: 'Pneumatic Framing Nailer Set — Unit 1',
      category: 'Pneumatic Tools',
      qrCode: 'CW-EQ-0021',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(400),
      inServiceDate: daysAgo(395),
      currentJobId: cedarHollow.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 395 }] },
    },
  });
  const pneumaticFinish = await prisma.equipment.create({
    data: {
      name: 'Pneumatic Finish Nailer Set — Unit 2',
      category: 'Pneumatic Tools',
      qrCode: 'CW-EQ-0022',
      status: EquipmentStatus.IDLE,
      acquisitionDate: daysAgo(400),
      inServiceDate: daysAgo(395),
      locationNote: 'Yard — Bay 1',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 395 }] },
    },
  });

  // Layout and reality-capture gear. The laser levels ride with whichever
  // job is mid-layout; the scanner and thermal camera are pooled, shared
  // specialty equipment checked out per site visit rather than assigned to
  // one job for the length of the build.
  const rotaryLaser = await prisma.equipment.create({
    data: {
      name: 'Rotary Laser Level — Unit 1',
      category: 'Layout & Survey Equipment',
      qrCode: 'CW-EQ-0023',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(500),
      inServiceDate: daysAgo(495),
      currentJobId: cedarHollow.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 495 }] },
    },
  });
  const lineLaser = await prisma.equipment.create({
    data: {
      name: 'Line Laser Level — Unit 2',
      category: 'Layout & Survey Equipment',
      qrCode: 'CW-EQ-0024',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(320),
      inServiceDate: daysAgo(315),
      currentJobId: harborPoint.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 315 }] },
    },
  });
  const scanner3d = await prisma.equipment.create({
    data: {
      name: '3D Reality-Capture Scanner — Unit 1',
      category: 'Layout & Survey Equipment',
      qrCode: 'CW-EQ-0025',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(180),
      inServiceDate: daysAgo(175),
      locationNote: 'Yard — Equipment Cage (pooled — checked out per site visit)',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 175 }] },
    },
  });
  const irCamera = await prisma.equipment.create({
    data: {
      name: 'Thermal Imaging Camera — Unit 1',
      category: 'Layout & Survey Equipment',
      qrCode: 'CW-EQ-0026',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(180),
      inServiceDate: daysAgo(175),
      locationNote: 'Yard — Equipment Cage (pooled — checked out per site visit)',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 175 }] },
    },
  });

  // Earthmoving. The skid steer, track loader, and plate compactor are the
  // same machines whether the job that week is site grading, foundation
  // backfill, or pond excavation and liner-bed compaction — that's a
  // scheduling and utilization question, not a reason to model a separate
  // equipment category.
  const skidSteer = await prisma.equipment.create({
    data: {
      name: 'Skid Steer Loader — Unit 4',
      category: 'Heavy Equipment',
      qrCode: 'CW-EQ-0027',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(600),
      inServiceDate: daysAgo(595),
      currentJobId: cedarHollow.id,
      lifeCounters: { create: [{ counterType: CounterType.RUN_HOURS, currentValue: 740 }] },
    },
  });
  const trackLoader = await prisma.equipment.create({
    data: {
      name: 'Compact Track Loader — Unit 5',
      category: 'Heavy Equipment',
      qrCode: 'CW-EQ-0028',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(340),
      inServiceDate: daysAgo(335),
      currentJobId: harborPoint.id,
      lifeCounters: { create: [{ counterType: CounterType.RUN_HOURS, currentValue: 410 }] },
    },
  });
  const plateCompactor = await prisma.equipment.create({
    data: {
      name: 'Plate Compactor — Unit 1',
      category: 'Heavy Equipment',
      qrCode: 'CW-EQ-0029',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(430),
      inServiceDate: daysAgo(425),
      currentJobId: cedarHollow.id,
      lifeCounters: { create: [{ counterType: CounterType.RUN_HOURS, currentValue: 260 }] },
    },
  });
  const dumpTrailer = await prisma.equipment.create({
    data: {
      name: 'Dump Trailer — T-6',
      category: 'Vehicles & Trailers',
      qrCode: 'CW-EQ-0030',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(720),
      inServiceDate: daysAgo(715),
      currentJobId: mapleCrossing.id,
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 715 }] },
    },
  });

  // PM-assigned vehicles, phones, and laptops. Custody (currentWorkerId)
  // rather than a job assignment is the honest model here — a PM running
  // multiple sites doesn't "check out" a truck to one of them, it's just
  // with them all week, which is also why none of these carry a
  // currentJobId the way job-site equipment does.
  const pmTruck1 = await prisma.equipment.create({
    data: {
      name: 'PM Field Truck — V-1',
      category: 'Vehicles & Trailers',
      qrCode: 'CW-EQ-0031',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(560),
      inServiceDate: daysAgo(555),
      currentWorkerId: renee.id,
      locationNote: 'With Renee Castellanos — rotates Cedar Hollow / Orchard Ridge',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 555 }] },
    },
  });
  const pmTruck2 = await prisma.equipment.create({
    data: {
      name: 'PM Field Truck — V-2',
      category: 'Vehicles & Trailers',
      qrCode: 'CW-EQ-0032',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(410),
      inServiceDate: daysAgo(405),
      currentWorkerId: kenji.id,
      locationNote: 'With Kenji Osei — rotates Harbor Point / Maple Crossing / Lakeview',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 405 }] },
    },
  });
  const pmPhone1 = await prisma.equipment.create({
    data: {
      name: 'PM Mobile Phone — Device 1',
      category: 'Technology & Devices',
      qrCode: 'CW-EQ-0033',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(560),
      inServiceDate: daysAgo(555),
      currentWorkerId: renee.id,
      locationNote: 'With Renee Castellanos',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 555 }] },
    },
  });
  const pmPhone2 = await prisma.equipment.create({
    data: {
      name: 'PM Mobile Phone — Device 2',
      category: 'Technology & Devices',
      qrCode: 'CW-EQ-0034',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(410),
      inServiceDate: daysAgo(405),
      currentWorkerId: kenji.id,
      locationNote: 'With Kenji Osei',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 405 }] },
    },
  });
  const pmLaptop1 = await prisma.equipment.create({
    data: {
      name: 'PM Laptop — Device 1',
      category: 'Technology & Devices',
      qrCode: 'CW-EQ-0035',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(560),
      inServiceDate: daysAgo(555),
      currentWorkerId: renee.id,
      locationNote: 'With Renee Castellanos',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 555 }] },
    },
  });
  const pmLaptop2 = await prisma.equipment.create({
    data: {
      name: 'PM Laptop — Device 2',
      category: 'Technology & Devices',
      qrCode: 'CW-EQ-0036',
      status: EquipmentStatus.ACTIVE,
      acquisitionDate: daysAgo(410),
      inServiceDate: daysAgo(405),
      currentWorkerId: kenji.id,
      locationNote: 'With Kenji Osei',
      lifeCounters: { create: [{ counterType: CounterType.CALENDAR_DAYS, currentValue: 405 }] },
    },
  });

  // ---------------------------------------------------------------------
  // Equipment compliance — deliberately covering: an item currently
  // in-tolerance, one overdue, one safety-critical hard limit, and one
  // multi-counter (hours + calendar) item to show whichever-comes-first.
  // ---------------------------------------------------------------------
  await prisma.equipmentCompliance.createMany({
    data: [
      // Excavator: 500-hour service interval, 50-hour tolerance. Last
      // serviced at the 1000-hour mark, due again at 1500 — currently at
      // 1180, with 320 hours still remaining, well clear of due-soon and
      // reading as a plain ok.
      { equipmentId: excavator.id, complianceType: ComplianceType.INSPECTION, counterType: CounterType.RUN_HOURS, intervalValue: 500, toleranceValue: 50, hardLimit: false, dueValue: 1500, lastCompletedAt: daysAgo(220), lastCompletedValue: 1000 },
      // Generator: hybrid-tracked, but modeled here on run-hours; due at
      // 350 hours and currently at 340 — due soon.
      { equipmentId: generator.id, complianceType: ComplianceType.INSPECTION, counterType: CounterType.RUN_HOURS, intervalValue: 350, toleranceValue: 25, hardLimit: false, dueValue: 350, lastCompletedAt: daysAgo(240), lastCompletedValue: 0 },
      // Fall-arrest harness: safety-critical, hard annual limit, no grace —
      // due at 180 days, now at 195, which is past the hard limit.
      { equipmentId: harness.id, complianceType: ComplianceType.INSPECTION, counterType: CounterType.CALENDAR_DAYS, intervalValue: 180, toleranceValue: 0, hardLimit: true, dueValue: 180, lastCompletedAt: daysAgo(195), lastCompletedValue: 0 },
      // Compressor: overdue calibration — currently down for service partly because of it.
      { equipmentId: compressor.id, complianceType: ComplianceType.CALIBRATION, counterType: CounterType.RUN_HOURS, intervalValue: 800, toleranceValue: 40, hardLimit: false, dueValue: 800, lastCompletedAt: daysAgo(600), lastCompletedValue: 0 },
      // Trailer: annual DOT-style inspection, well within schedule.
      { equipmentId: trailer.id, complianceType: ComplianceType.INSPECTION, counterType: CounterType.CALENDAR_DAYS, intervalValue: 365, toleranceValue: 14, hardLimit: false, dueValue: 1095 + 270, lastCompletedAt: daysAgo(95), lastCompletedValue: 1000 },
    ],
  });
  await prisma.equipmentCompliance.createMany({
    data: [
      // Skid steer: 250-run-hour service interval, currently 10 hours out
      // from due — the same due-soon shape as the generator above.
      { equipmentId: skidSteer.id, complianceType: ComplianceType.INSPECTION, counterType: CounterType.RUN_HOURS, intervalValue: 250, toleranceValue: 20, hardLimit: false, dueValue: 750, lastCompletedAt: daysAgo(150), lastCompletedValue: 500 },
      // PM phone: manufacturer warranty tracked the same way a hard-limit
      // safety item is — no grace once it lapses. Comfortably current.
      { equipmentId: pmPhone1.id, complianceType: ComplianceType.WARRANTY, counterType: CounterType.CALENDAR_DAYS, intervalValue: 730, toleranceValue: 0, hardLimit: true, dueValue: 730, lastCompletedAt: daysAgo(560), lastCompletedValue: 0 },
      // PM laptop: same warranty pattern, deliberately past it — an
      // expired-warranty flag a GM actually wants ahead of budgeting a
      // replacement, not something that blocks anything operational.
      { equipmentId: pmLaptop2.id, complianceType: ComplianceType.WARRANTY, counterType: CounterType.CALENDAR_DAYS, intervalValue: 365, toleranceValue: 0, hardLimit: true, dueValue: 365, lastCompletedAt: daysAgo(410), lastCompletedValue: 0 },
    ],
  });

  // ---------------------------------------------------------------------
  // Maintenance plans — a nested pair on the excavator (90-day comprehensive
  // service folding in the 30-day check) to demonstrate suppression.
  // ---------------------------------------------------------------------
  const excavator90 = await prisma.maintenancePlan.create({
    data: {
      equipmentId: excavator.id,
      description: 'Comprehensive 90-day service — fluids, filters, undercarriage inspection',
      counterType: CounterType.CALENDAR_DAYS,
      intervalValue: 90,
      toleranceValue: 7,
      hardLimit: false,
      dueValue: 810, // aligned to a shared 90-day cycle boundary for the demo data
    },
  });
  await prisma.maintenancePlan.create({
    data: {
      equipmentId: excavator.id,
      parentPlanId: excavator90.id,
      description: '30-day visual and fluid-level check',
      counterType: CounterType.CALENDAR_DAYS,
      intervalValue: 30,
      toleranceValue: 3,
      hardLimit: false,
      dueValue: 810, // due the same cycle as the 90-day plan — will be suppressed when it's completed
    },
  });
  await prisma.maintenancePlan.create({
    data: {
      equipmentId: compressor.id,
      description: 'Compressor calibration and pressure-relief valve service',
      counterType: CounterType.RUN_HOURS,
      intervalValue: 800,
      toleranceValue: 40,
      hardLimit: false,
      dueValue: 800,
    },
  });

  // ---------------------------------------------------------------------
  // A work order already open against the compressor, sourced from a
  // defect reported at check-in — demonstrating the scan-to-work-order link.
  // ---------------------------------------------------------------------
  const compressorScan = await prisma.scanEvent.create({
    data: {
      equipmentId: compressor.id,
      scannedByWorkerId: bigSam.id,
      action: ScanAction.DEFECT_REPORTED,
      conditionNote: 'Pressure relief valve cycling early under load. Pulled from service, flagged for calibration tech.',
      timestamp: daysAgo(6),
    },
  });
  await prisma.workOrder.create({
    data: {
      equipmentId: compressor.id,
      source: WorkOrderSource.DEFECT_REPORTED,
      status: WorkOrderStatus.OPEN,
      description: 'Investigate and correct early-cycling pressure relief valve; recalibrate before returning to service.',
      createdFromScanEventId: compressorScan.id,
    },
  });

  // A handful of ordinary check-out/check-in scan history for the trailer.
  await prisma.scanEvent.createMany({
    data: [
      { equipmentId: trailer.id, scannedByWorkerId: teo.id, jobId: harborPoint.id, action: ScanAction.CHECK_OUT, timestamp: daysAgo(15), latitude: 47.9789, longitude: -122.2021 },
      { equipmentId: excavator.id, scannedByWorkerId: bigSam.id, jobId: mapleCrossing.id, action: ScanAction.CHECK_OUT, timestamp: daysAgo(10), latitude: 47.7623, longitude: -122.2054 },
      // The pooled scanner actually moving between sites — the kind of
      // history that's the point of tracking a shared asset by scan rather
      // than by a single currentJobId.
      { equipmentId: scanner3d.id, scannedByWorkerId: renee.id, jobId: cedarHollow.id, action: ScanAction.CHECK_OUT, timestamp: daysAgo(3), latitude: 47.9184, longitude: -122.0982 },
      { equipmentId: dumpTrailer.id, scannedByWorkerId: bigSam.id, jobId: mapleCrossing.id, action: ScanAction.CHECK_OUT, timestamp: daysAgo(8), latitude: 47.7623, longitude: -122.2054 },
    ],
  });

  // ---------------------------------------------------------------------
  // Crew requirements — each job's staffing plan, independent of who's
  // actually assigned. Cedar Hollow's unfilled electrician role and Orchard
  // Ridge's unfilled superintendent/sitework roles are deliberate: a job
  // can be fully staffed on paper (no scheduling conflicts) and still be
  // missing a trade the crew list alone would never surface. roleOrTrade
  // is matched by exact string against Assignment.roleOnJob, so these are
  // written to line up with the roleOnJob values in the assignments above.
  // ---------------------------------------------------------------------
  await prisma.jobRoleRequirement.createMany({
    data: [
      { jobId: cedarHollow.id, roleOrTrade: 'Site Superintendent', requiredCount: 1 },
      { jobId: cedarHollow.id, roleOrTrade: 'Carpenter Foreman', requiredCount: 1 },
      { jobId: cedarHollow.id, roleOrTrade: 'Carpenter', requiredCount: 2 },
      { jobId: cedarHollow.id, roleOrTrade: 'Licensed Electrician', requiredCount: 1 }, // unfilled — no electrician assigned to this job yet
      // requiredCertTypes set here so the certification hard-stop has
      // somewhere to actually run: Teo Salvador holds exactly this cert
      // (see his WorkerCertification above) and is already assigned here as
      // 'Electrician', so this requirement is satisfied as seeded — try
      // assigning a second worker who DOESN'T hold it to this same role on
      // Harbor Point to see the 409 fire.
      { jobId: harborPoint.id, roleOrTrade: 'Electrician', requiredCount: 1, requiredCertTypes: 'Master Electrician License' },
      { jobId: harborPoint.id, roleOrTrade: 'Project Manager', requiredCount: 1 },
      { jobId: orchardRidge.id, roleOrTrade: 'Site Superintendent', requiredCount: 1 }, // unfilled — job hasn't broken ground yet
      { jobId: orchardRidge.id, roleOrTrade: 'Excavation Contractor', requiredCount: 1 }, // unfilled — sitework not yet staffed
      { jobId: orchardRidge.id, roleOrTrade: 'Project Manager', requiredCount: 1 },
      { jobId: mapleCrossing.id, roleOrTrade: 'Plumber', requiredCount: 1 },
      { jobId: mapleCrossing.id, roleOrTrade: 'Heavy Equipment Operator', requiredCount: 1 },
      { jobId: mapleCrossing.id, roleOrTrade: 'Laborer', requiredCount: 1 },
      { jobId: mapleCrossing.id, roleOrTrade: 'Project Manager', requiredCount: 1 },
    ],
  });

  // ---------------------------------------------------------------------
  // Equipment reservations — forward bookings, distinct from the current-
  // custody fields set on Equipment above. The skid steer is deliberately
  // double-booked between Cedar Hollow and Orchard Ridge so the conflict
  // detector has a real overlap to catch; the rest are ordinary,
  // non-overlapping forward plans, including one asset booked to a
  // different job than the one it's currently sitting at — the plan-vs-
  // fact distinction this table exists to capture.
  // ---------------------------------------------------------------------
  await prisma.equipmentReservation.createMany({
    data: [
      { equipmentId: skidSteer.id, jobId: cedarHollow.id, start: daysFromNow(5), end: daysFromNow(12) },
      // Overlaps the reservation above by two days — the deliberate conflict.
      { equipmentId: skidSteer.id, jobId: orchardRidge.id, start: daysFromNow(10), end: daysFromNow(20) },
      { equipmentId: trackLoader.id, jobId: harborPoint.id, start: daysFromNow(3), end: daysFromNow(8) },
      { equipmentId: excavator.id, jobId: mapleCrossing.id, start: daysAgo(2), end: daysFromNow(6) },
      { equipmentId: scaffold.id, jobId: orchardRidge.id, start: daysFromNow(14), end: daysFromNow(45) },
      { equipmentId: plateCompactor.id, jobId: cedarHollow.id, start: daysFromNow(1), end: daysFromNow(3) },
      // Normally sits at Maple Crossing but is booked out to Cedar Hollow
      // for a short haul-off window.
      { equipmentId: dumpTrailer.id, jobId: cedarHollow.id, start: daysFromNow(6), end: daysFromNow(9) },
      // A second, differently-shaped conflict: booked forward on an asset
      // that's currently DOWN_FOR_SERVICE with no return-to-service date on
      // file — a warning on the job it's booked to, not a hard block, since
      // a future booking's problem shouldn't stop today's readiness the way
      // an asset actually on-site and broken would.
      { equipmentId: compressor.id, jobId: harborPoint.id, start: daysFromNow(4), end: daysFromNow(6) },
    ],
  });

  // ---------------------------------------------------------------------
  // Permits and inspections — the legal gate on whether work can proceed
  // at all. Cedar Hollow's failed framing inspection and Lakeview's
  // expired permit are the deliberate blocked-path examples; Maple
  // Crossing's fully-finaled set shows the ordinary, healthy case; Orchard
  // Ridge shows the pre-construction, still-applied-for case.
  // ---------------------------------------------------------------------
  await prisma.permit.create({
    data: {
      jobId: cedarHollow.id,
      permitType: PermitType.BUILDING,
      permitNumber: 'SC-BLD-0742',
      issuingAuthority: 'Snohomish County Department of Planning and Development',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(50),
      issuedDate: daysAgo(44),
      expiryDate: daysFromNow(300),
      inspections: {
        create: [
          { inspectionType: InspectionType.FOOTING, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(40) },
          { inspectionType: InspectionType.FOUNDATION, sequence: 2, status: InspectionStatus.PASSED, completedDate: daysAgo(30) },
          {
            inspectionType: InspectionType.FRAMING,
            sequence: 3,
            status: InspectionStatus.FAILED,
            completedDate: daysAgo(5),
            inspectorNotes:
              'Shear wall nailing pattern at grid line C does not match the approved schedule. Re-nail and request re-inspection before proceeding to insulation.',
            correctionNotes:
              'Shear panels re-nailed at grid line C per the corrected nailing schedule; photos logged to the job file before requesting re-inspection.',
            correctionResponsible: 'Marcus Ibe, Carpenter Foreman',
            reinspectionChannel: ReinspectionChannel.IN_PERSON,
            reinspectionScheduledDate: daysFromNow(3),
          },
          { inspectionType: InspectionType.INSULATION, sequence: 4, status: InspectionStatus.NOT_SCHEDULED },
          { inspectionType: InspectionType.FINAL, sequence: 5, status: InspectionStatus.NOT_SCHEDULED },
        ],
      },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: cedarHollow.id,
      permitType: PermitType.ELECTRICAL,
      permitNumber: 'SC-ELE-0318',
      issuingAuthority: 'Snohomish County Department of Planning and Development',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(48),
      issuedDate: daysAgo(41),
      expiryDate: daysFromNow(300),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_ELECTRICAL, sequence: 1, status: InspectionStatus.NOT_SCHEDULED }] },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: cedarHollow.id,
      permitType: PermitType.PLUMBING,
      permitNumber: 'SC-PLM-0291',
      issuingAuthority: 'Snohomish County Department of Planning and Development',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(48),
      issuedDate: daysAgo(41),
      expiryDate: daysFromNow(300),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_PLUMBING, sequence: 1, status: InspectionStatus.NOT_SCHEDULED }] },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: cedarHollow.id,
      permitType: PermitType.MECHANICAL,
      permitNumber: 'SC-MEC-0155',
      issuingAuthority: 'Snohomish County Department of Planning and Development',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(46),
      issuedDate: daysAgo(39),
      expiryDate: daysFromNow(300),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_MECHANICAL, sequence: 1, status: InspectionStatus.NOT_SCHEDULED }] },
    },
  });

  await prisma.permit.create({
    data: {
      jobId: harborPoint.id,
      permitType: PermitType.BUILDING,
      permitNumber: 'EV-BLD-1140',
      issuingAuthority: 'City of Everett Building Division',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(25),
      issuedDate: daysAgo(19),
      expiryDate: daysFromNow(340),
      inspections: {
        create: [
          { inspectionType: InspectionType.FRAMING, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(12) },
          { inspectionType: InspectionType.INSULATION, sequence: 2, status: InspectionStatus.PASSED, completedDate: daysAgo(4) },
          { inspectionType: InspectionType.FINAL, sequence: 3, status: InspectionStatus.SCHEDULED, scheduledDate: daysFromNow(5) },
        ],
      },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: harborPoint.id,
      permitType: PermitType.ELECTRICAL,
      permitNumber: 'EV-ELE-0512',
      issuingAuthority: 'City of Everett Building Division',
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(24),
      issuedDate: daysAgo(18),
      expiryDate: daysFromNow(340),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_ELECTRICAL, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(6) }] },
    },
  });

  await prisma.permit.create({
    data: {
      jobId: orchardRidge.id,
      permitType: PermitType.BUILDING,
      issuingAuthority: 'King County Permitting Division',
      status: PermitStatus.APPLIED,
      appliedDate: daysAgo(20),
    },
  });
  await prisma.permit.create({
    data: {
      jobId: orchardRidge.id,
      permitType: PermitType.GRADING,
      issuingAuthority: 'King County Permitting Division',
      status: PermitStatus.APPLIED,
      appliedDate: daysAgo(25),
    },
  });

  await prisma.permit.create({
    data: {
      jobId: mapleCrossing.id,
      permitType: PermitType.BUILDING,
      permitNumber: 'BO-BLD-0088',
      issuingAuthority: 'City of Bothell Community Development',
      status: PermitStatus.FINALED,
      appliedDate: daysAgo(95),
      issuedDate: daysAgo(88),
      expiryDate: daysFromNow(200),
      inspections: {
        create: [
          { inspectionType: InspectionType.FOOTING, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(85) },
          { inspectionType: InspectionType.FOUNDATION, sequence: 2, status: InspectionStatus.PASSED, completedDate: daysAgo(75) },
          { inspectionType: InspectionType.FRAMING, sequence: 3, status: InspectionStatus.PASSED, completedDate: daysAgo(50) },
          { inspectionType: InspectionType.INSULATION, sequence: 4, status: InspectionStatus.PASSED, completedDate: daysAgo(20) },
          { inspectionType: InspectionType.FINAL, sequence: 5, status: InspectionStatus.PASSED, completedDate: daysAgo(3) },
        ],
      },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: mapleCrossing.id,
      permitType: PermitType.ELECTRICAL,
      permitNumber: 'BO-ELE-0044',
      issuingAuthority: 'City of Bothell Community Development',
      status: PermitStatus.FINALED,
      appliedDate: daysAgo(93),
      issuedDate: daysAgo(86),
      expiryDate: daysFromNow(200),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_ELECTRICAL, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(45) }] },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: mapleCrossing.id,
      permitType: PermitType.PLUMBING,
      permitNumber: 'BO-PLM-0039',
      issuingAuthority: 'City of Bothell Community Development',
      status: PermitStatus.FINALED,
      appliedDate: daysAgo(93),
      issuedDate: daysAgo(86),
      expiryDate: daysFromNow(200),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_PLUMBING, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(48) }] },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: mapleCrossing.id,
      permitType: PermitType.MECHANICAL,
      permitNumber: 'BO-MEC-0021',
      issuingAuthority: 'City of Bothell Community Development',
      status: PermitStatus.FINALED,
      appliedDate: daysAgo(91),
      issuedDate: daysAgo(84),
      expiryDate: daysFromNow(200),
      inspections: { create: [{ inspectionType: InspectionType.ROUGH_IN_MECHANICAL, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(42) }] },
    },
  });

  // Deliberate blocked-path example: issued, partly inspected, then lapsed
  // before the project reached final — which is also the honest reason
  // this job is sitting on hold rather than mobilized.
  await prisma.permit.create({
    data: {
      jobId: lakeview.id,
      permitType: PermitType.BUILDING,
      permitNumber: 'KI-BLD-0967',
      issuingAuthority: 'City of Kirkland Building & Development',
      status: PermitStatus.EXPIRED,
      appliedDate: daysAgo(250),
      issuedDate: daysAgo(220),
      expiryDate: daysAgo(15),
      inspections: {
        create: [
          { inspectionType: InspectionType.FRAMING, sequence: 1, status: InspectionStatus.PASSED, completedDate: daysAgo(180) },
          { inspectionType: InspectionType.FINAL, sequence: 2, status: InspectionStatus.NOT_SCHEDULED },
        ],
      },
    },
  });
  // Lakeview is light-commercial tenant-improvement work, which routinely
  // pulls concurrent permits from more than one authority on different
  // clocks — unlike the single building-department permit each residential
  // job above needs. The lapsed building permit above is what's actually
  // holding the job; the fire and health permits are on separate tracks,
  // and one of them is fine, which a job-level-only view would hide.
  await prisma.permit.create({
    data: {
      jobId: lakeview.id,
      permitType: PermitType.FIRE,
      permitNumber: 'EFR-FIR-2214',
      issuingAuthority: "Eastside Fire & Rescue — Fire Marshal's Office",
      status: PermitStatus.ISSUED,
      appliedDate: daysAgo(60),
      issuedDate: daysAgo(52),
      expiryDate: daysFromNow(310),
      inspections: { create: [{ inspectionType: InspectionType.FINAL, sequence: 1, status: InspectionStatus.SCHEDULED, scheduledDate: daysFromNow(8) }] },
    },
  });
  await prisma.permit.create({
    data: {
      jobId: lakeview.id,
      permitType: PermitType.HEALTH,
      issuingAuthority: 'Public Health — Seattle & King County',
      status: PermitStatus.APPLIED,
      appliedDate: daysAgo(18),
    },
  });

  // ---------------------------------------------------------------------
  // Daily field log — standard GC documentation, the kind that matters in
  // a dispute or a warranty claim. Informational only; see the doc
  // comment on the DailyLog model for why it doesn't feed readiness.
  // ---------------------------------------------------------------------
  await prisma.dailyLog.createMany({
    data: [
      { jobId: cedarHollow.id, logDate: daysAgo(9), weatherSummary: 'Overcast, high 54°F, light rain PM', crewCount: 5, workPerformed: 'Continued exterior wall framing on the north elevation; set headers for the great room windows.', submittedBy: dale.id },
      { jobId: cedarHollow.id, logDate: daysAgo(7), weatherSummary: 'Clear, high 61°F', crewCount: 6, workPerformed: 'Completed second-floor deck sheathing; began roof truss layout.', submittedBy: dale.id },
      { jobId: cedarHollow.id, logDate: daysAgo(6), weatherSummary: 'Clear, high 59°F', crewCount: 5, workPerformed: 'Owner (Walt Ferreira) and the project architect on site for a pre-drywall walk-through of framing and rough-ins; no issues raised.', submittedBy: dale.id },
      { jobId: cedarHollow.id, logDate: daysAgo(5), weatherSummary: 'Rain most of the day, high 49°F', crewCount: 4, workPerformed: 'Framing inspection with the county (failed — shear wall nailing at grid C); crew shifted to interior blocking while the re-nail plan was worked out.', delaysNotes: 'Framing inspection failed — see permit record. Re-nailing grid line C before re-inspection can be requested.', submittedBy: dale.id },
      { jobId: cedarHollow.id, logDate: daysAgo(2), weatherSummary: 'Partly cloudy, high 58°F', crewCount: 5, workPerformed: 'Re-nailed shear panels at grid line C per the corrected schedule; requested re-inspection.', submittedBy: dale.id },
      { jobId: harborPoint.id, logDate: daysAgo(8), weatherSummary: 'Clear, high 64°F', crewCount: 3, workPerformed: 'Demo of the existing kitchen and adjacent bath complete; debris hauled off-site.', submittedBy: kenji.id },
      // Hidden condition surfaced during demo — the kind of remodel-specific
      // find that never shows up on a new-build job, logged the way a real
      // GC logs it: photographed, flagged for the PM, and worked through
      // before closing the wall back up.
      { jobId: harborPoint.id, logDate: daysAgo(6), weatherSummary: 'Overcast, high 55°F', crewCount: 3, workPerformed: 'Opened up the north bathroom wall during demo and found an old, undocumented plumbing patch with minor water staining on the subfloor. Photographed and flagged for the PM before closing the wall back up.', delaysNotes: 'Held the wall open an extra half-day pending PM review of the hidden condition; no structural concern found, cleared to proceed.', submittedBy: kenji.id },
      { jobId: harborPoint.id, logDate: daysAgo(4), weatherSummary: 'Overcast, high 57°F', crewCount: 3, workPerformed: 'Rough electrical for the kitchen relocation passed inspection; plumbing on standby pending fixture delivery.', delaysNotes: 'Fixture delivery delayed by the supplier — plumbing rough-in pushed two days.', submittedBy: kenji.id },
      { jobId: harborPoint.id, logDate: daysAgo(2), weatherSummary: 'Partly cloudy, high 60°F', crewCount: 4, workPerformed: 'Homeowner stopped by mid-morning to review tile selection with the crew ahead of the shower pan install.', submittedBy: kenji.id },
      { jobId: harborPoint.id, logDate: daysAgo(1), weatherSummary: 'Clear, high 62°F', crewCount: 4, workPerformed: 'Insulation pass complete in the kitchen and bath; drywall crew scheduled to start Monday.', submittedBy: kenji.id },
      { jobId: mapleCrossing.id, logDate: daysAgo(6), weatherSummary: 'Clear, high 68°F', crewCount: 4, workPerformed: 'Final grading and landscaping prep around the foundation perimeter; dump trailer hauling excess spoils off-site.', submittedBy: kenji.id },
      { jobId: mapleCrossing.id, logDate: daysAgo(3), weatherSummary: 'Clear, high 70°F', crewCount: 3, workPerformed: 'Punch-list walk with the PM; touch-up paint and final plumbing fixture install.', submittedBy: kenji.id },
      { jobId: mapleCrossing.id, logDate: daysAgo(1), weatherSummary: 'Clear, high 71°F', crewCount: 2, workPerformed: 'Homeowner and their interior designer walked the finished spaces to confirm the paint touch-up list ahead of substantial completion.', submittedBy: kenji.id },
    ],
  });

  // ---------------------------------------------------------------------
  // Toolbox talks — safety-culture documentation. Like the daily log, this
  // doesn't gate readiness; it's evidence of an operating safety program.
  // ---------------------------------------------------------------------
  await prisma.safetyMeeting.create({
    data: {
      jobId: cedarHollow.id,
      meetingDate: daysAgo(30),
      topic: 'Fall protection and harness inspection before roof work',
      conductedBy: dale.id,
      attendees: { create: [{ workerId: dale.id }, { workerId: marcus.id }, { workerId: priya.id }] },
    },
  });
  await prisma.safetyMeeting.create({
    data: {
      jobId: cedarHollow.id,
      meetingDate: daysAgo(7),
      topic: 'Ladder safety and material staging on uneven grade',
      conductedBy: marcus.id,
      attendees: { create: [{ workerId: marcus.id }, { workerId: priya.id }, { workerId: ollie.id }] },
    },
  });
  await prisma.safetyMeeting.create({
    data: {
      jobId: harborPoint.id,
      meetingDate: daysAgo(15),
      topic: 'Lead-safe work practices for pre-1978 renovation',
      conductedBy: kenji.id,
      attendees: { create: [{ workerId: teo.id }, { workerId: ollie.id }, { workerId: kenji.id }] },
    },
  });
  await prisma.safetyMeeting.create({
    data: {
      jobId: harborPoint.id,
      meetingDate: daysAgo(2),
      topic: 'Extension cord and GFCI protection on temporary power',
      conductedBy: teo.id,
      attendees: { create: [{ workerId: teo.id }, { workerId: ollie.id }] },
    },
  });
  await prisma.safetyMeeting.create({
    data: {
      jobId: mapleCrossing.id,
      meetingDate: daysAgo(20),
      topic: 'Trenching and excavation safety near the property line',
      conductedBy: kenji.id,
      attendees: { create: [{ workerId: bigSam.id }, { workerId: jules.id }, { workerId: renata.id }] },
    },
  });
  await prisma.safetyMeeting.create({
    data: {
      jobId: mapleCrossing.id,
      meetingDate: daysAgo(6),
      topic: 'Heat stress awareness and hydration',
      conductedBy: kenji.id,
      attendees: { create: [{ workerId: bigSam.id }, { workerId: jules.id }] },
    },
  });

  // ---------------------------------------------------------------------
  // Lien waivers — one pending, one received, one disputed, spanning both
  // subcontractor firms already on file above.
  // ---------------------------------------------------------------------
  await prisma.lienWaiver.createMany({
    data: [
      {
        jobId: cedarHollow.id,
        subcontractorId: salvadorElectric.id,
        waiverType: LienWaiverType.CONDITIONAL_PROGRESS,
        payPeriodStart: daysAgo(30),
        payPeriodEnd: daysAgo(16),
        amount: 18400,
        status: LienWaiverStatus.PENDING,
      },
      {
        jobId: cedarHollow.id,
        subcontractorId: choPlumbing.id,
        waiverType: LienWaiverType.UNCONDITIONAL_PROGRESS,
        payPeriodStart: daysAgo(60),
        payPeriodEnd: daysAgo(46),
        amount: 9750,
        status: LienWaiverStatus.RECEIVED,
        receivedDate: daysAgo(40),
      },
      // Deliberately disputed — the amount on the waiver didn't match what
      // Cho Plumbing invoiced for the period, which is exactly the kind of
      // mismatch this status exists to flag before a payment goes out.
      {
        jobId: mapleCrossing.id,
        subcontractorId: choPlumbing.id,
        waiverType: LienWaiverType.CONDITIONAL_FINAL,
        payPeriodStart: daysAgo(20),
        payPeriodEnd: daysAgo(6),
        amount: 4200,
        status: LienWaiverStatus.DISPUTED,
        notes: 'Amount does not match Cho Plumbing\'s invoice for the period — following up before payment.',
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Safety incidents — a near miss (open) and a closed low-severity
  // property-damage incident, the ordinary shape a small-mid GC actually
  // logs day to day rather than anything catastrophic.
  // ---------------------------------------------------------------------
  await prisma.safetyIncident.createMany({
    data: [
      {
        jobId: cedarHollow.id,
        incidentType: IncidentType.NEAR_MISS,
        severity: IncidentSeverity.MEDIUM,
        occurredAt: daysAgo(4),
        description: 'Scaffold plank shifted underfoot while framing the north gable — worker caught themselves on the guardrail, no fall occurred.',
        reportedByWorkerId: marcus.id,
        involvedWorkerId: priya.id,
        status: 'OPEN',
      },
      {
        jobId: mapleCrossing.id,
        incidentType: IncidentType.PROPERTY_DAMAGE,
        severity: IncidentSeverity.LOW,
        occurredAt: daysAgo(9),
        description: 'Skid steer clipped a landscape timber while backfilling, cracking it.',
        correctionAction: 'Timber replaced same day; operator briefed on the tightened clearance around the bed edge.',
        reportedByWorkerId: bigSam.id,
        status: 'CLOSED',
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Job hazard analyses — one per active job with a task worth a written
  // JHA rather than just a toolbox talk.
  // ---------------------------------------------------------------------
  await prisma.jobHazardAnalysis.createMany({
    data: [
      {
        jobId: cedarHollow.id,
        taskDescription: 'Second-floor exterior wall framing and sheathing',
        hazardsIdentified: 'Fall from elevated work surface; struck-by from material staged on the deck edge.',
        controlMeasures: 'Guardrails at all open edges; harness and tie-off above 6 ft; materials staged at least 6 ft back from the edge.',
        reviewDate: daysAgo(45),
        preparedByWorkerId: dale.id,
      },
      {
        jobId: mapleCrossing.id,
        taskDescription: 'Trench excavation for perimeter drain',
        hazardsIdentified: 'Trench wall collapse; struck-by from the excavator swing radius.',
        controlMeasures: 'Sloped/benched per soil type below 5 ft; spoil pile kept 2 ft back from the edge; ground guide posted whenever the excavator is swinging near the trench.',
        reviewDate: daysAgo(22),
        preparedByWorkerId: kenji.id,
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Certified payroll — Lakeview is the one seeded job with
  // certifiedPayrollRequired set (see Job.certifiedPayrollRequired's
  // schema comment). One draft, one already submitted.
  // ---------------------------------------------------------------------
  await prisma.certifiedPayrollEntry.createMany({
    data: [
      {
        jobId: lakeview.id,
        workerId: kenji.id,
        weekEnding: daysAgo(7),
        classification: 'Project Manager',
        hoursWorked: 40,
        hourlyRate: 62,
        fringeRate: 14.5,
        status: 'SUBMITTED',
      },
      {
        // Same worker as above, a more recent week — kenji is the only
        // worker actually assigned to Lakeview in this seed set (see the
        // assignments block above), so this stays consistent with who's
        // really on the job rather than pulling in a name from elsewhere.
        jobId: lakeview.id,
        workerId: kenji.id,
        weekEnding: daysAgo(0),
        classification: 'Project Manager',
        hoursWorked: 36,
        hourlyRate: 62,
        fringeRate: 14.5,
        status: 'DRAFT',
      },
    ],
  });

  const equipmentCount = await prisma.equipment.count();
  const subcontractorCount = await prisma.subcontractor.count();
  const roleRequirementCount = await prisma.jobRoleRequirement.count();
  const reservationCount = await prisma.equipmentReservation.count();
  const permitCount = await prisma.permit.count();
  const inspectionCount = await prisma.inspection.count();
  const dailyLogCount = await prisma.dailyLog.count();
  const safetyMeetingCount = await prisma.safetyMeeting.count();
  const lienWaiverCount = await prisma.lienWaiver.count();
  const safetyIncidentCount = await prisma.safetyIncident.count();
  const hazardAnalysisCount = await prisma.jobHazardAnalysis.count();
  const payrollEntryCount = await prisma.certifiedPayrollEntry.count();
  console.log(
    `Seeded ${jobs.length} jobs, ${workers.length} workers, ${subcontractorCount} subcontractor firms, ` +
      `${equipmentCount} equipment items, ${roleRequirementCount} role requirements, ` +
      `${reservationCount} equipment reservations, ${permitCount} permits (${inspectionCount} inspections), ` +
      `${dailyLogCount} daily logs, ${safetyMeetingCount} toolbox talks, ${lienWaiverCount} lien waivers, ` +
      `${safetyIncidentCount} safety incidents, ${hazardAnalysisCount} JHAs, ${payrollEntryCount} certified payroll entries.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
