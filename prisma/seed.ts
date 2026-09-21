/**
 * Seed data for Coastwood Builders, a fictional vertically-integrated
 * custom-home GC operating in the Pacific Northwest — every name, address,
 * and figure below is invented for this demo and does not describe any
 * real company, project, or person.
 *
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { EmploymentType, JobStatus, WeatherSensitivity, EquipmentStatus, CounterType, ComplianceType, ScanAction, WorkOrderSource, WorkOrderStatus } from '../lib/enums';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * DAY);
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

async function main() {
  console.log('Seeding Coastwood Builders demo data...');

  await prisma.scanPhoto.deleteMany();
  await prisma.scanEvent.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.equipmentCompliance.deleteMany();
  await prisma.equipmentLifeCounter.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.workerCertification.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.weatherCache.deleteMany();
  await prisma.worker.deleteMany();
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
      },
    }),
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
      },
    }),
  ]);
  const [cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview] = jobs;

  // ---------------------------------------------------------------------
  // Workers — a mix of direct employees and subcontractors, matching a
  // realistic small-mid GC crew composition.
  // ---------------------------------------------------------------------
  const workers = await Promise.all([
    prisma.worker.create({ data: { name: 'Dale Petrenko', trade: 'Site Superintendent', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(900) } }),
    prisma.worker.create({ data: { name: 'Marcus Ibe', trade: 'Carpenter Foreman', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(720) } }),
    prisma.worker.create({ data: { name: 'Priya Nandan', trade: 'Carpenter', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(500) } }),
    prisma.worker.create({ data: { name: 'Ollie Fenwick', trade: 'Carpenter', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(310) } }),
    prisma.worker.create({ data: { name: 'Teo Salvador', trade: 'Electrician', employmentType: EmploymentType.SUBCONTRACTOR, hireDate: daysAgo(600) } }),
    prisma.worker.create({ data: { name: 'Renata Cho', trade: 'Plumber', employmentType: EmploymentType.SUBCONTRACTOR, hireDate: daysAgo(480) } }),
    prisma.worker.create({ data: { name: 'Big Sam Okonkwo', trade: 'Heavy Equipment Operator', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(650) } }),
    prisma.worker.create({ data: { name: 'Jules Whitfield', trade: 'Laborer', employmentType: EmploymentType.DIRECT_EMPLOYEE, hireDate: daysAgo(150) } }),
  ]);
  const [dale, marcus, priya, ollie, teo, renata, bigSam, jules] = workers;

  // Certifications — a deliberate spread of valid, expiring-soon, and
  // expired so the dashboard has something real to flag.
  await prisma.workerCertification.createMany({
    data: [
      { workerId: dale.id, certType: 'OSHA 30', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(1000), expiryDate: daysFromNow(400) },
      { workerId: dale.id, certType: 'First Aid / CPR', issuingBody: 'Red Cross', issueDate: daysAgo(700), expiryDate: daysFromNow(20) }, // expiring soon
      { workerId: marcus.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(900), expiryDate: daysFromNow(600) },
      { workerId: marcus.id, certType: 'Confined Space Entry', issuingBody: 'Coastwood Internal Training', issueDate: daysAgo(400), expiryDate: daysAgo(5) }, // expired
      { workerId: priya.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(500), expiryDate: daysFromNow(550) },
      { workerId: bigSam.id, certType: 'Forklift Operator', issuingBody: 'Coastwood Internal Training', issueDate: daysAgo(300), expiryDate: daysFromNow(45) },
      { workerId: bigSam.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(800), expiryDate: daysFromNow(700) },
      { workerId: jules.id, certType: 'OSHA 10', issuingBody: 'OSHA Outreach Training Program', issueDate: daysAgo(120), expiryDate: daysFromNow(1100) },
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
  // Equipment compliance — deliberately covering: an item currently
  // in-tolerance, one overdue, one safety-critical hard limit, and one
  // multi-counter (hours + calendar) item to show whichever-comes-first.
  // ---------------------------------------------------------------------
  await prisma.equipmentCompliance.createMany({
    data: [
      // Excavator: 500-hour service interval, 50-hour tolerance. Last
      // serviced at the 1000-hour mark, due again at 1500 — currently at
      // 1180, comfortably inside the window (due_soon territory).
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
    ],
  });

  console.log(`Seeded ${jobs.length} jobs, ${workers.length} workers, 6 equipment items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
