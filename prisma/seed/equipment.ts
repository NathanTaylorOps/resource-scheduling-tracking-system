import type { PrismaClient } from '@prisma/client';
import {
  EmploymentType, JobStatus, WeatherSensitivity, EquipmentStatus, CounterType, ComplianceType,
  ScanAction, WorkOrderSource, WorkOrderStatus, PermitType, PermitStatus, InspectionType,
  InspectionStatus, ReinspectionChannel, RenewalPattern, CoverageType, LienWaiverType,
  LienWaiverStatus, IncidentType, IncidentSeverity,
} from '../../lib/enums';
import type { SeedClock } from './clock';
import type { CoreSeed } from './core';

export async function seedEquipment(prisma: PrismaClient, clock: SeedClock, core: CoreSeed) {
  const { daysFromNow, daysAgo } = clock;
  const { cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview, walt, dale, marcus, priya, ollie, teo, renata, bigSam, jules, renee, kenji } = core;
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

}
