import type { PrismaClient } from '@prisma/client';
import {
  EmploymentType, JobStatus, WeatherSensitivity, EquipmentStatus, CounterType, ComplianceType,
  ScanAction, WorkOrderSource, WorkOrderStatus, PermitType, PermitStatus, InspectionType,
  InspectionStatus, ReinspectionChannel, RenewalPattern, CoverageType, LienWaiverType,
  LienWaiverStatus, IncidentType, IncidentSeverity,
} from '../../lib/enums';
import type { SeedClock } from './clock';
import type { CoreSeed } from './core';

export async function seedPermits(prisma: PrismaClient, clock: SeedClock, core: CoreSeed) {
  const { daysFromNow, daysAgo } = clock;
  const { cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview } = core;
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

}
