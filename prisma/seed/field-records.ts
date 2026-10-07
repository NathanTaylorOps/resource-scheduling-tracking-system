import type { PrismaClient } from '@prisma/client';
import {
  EmploymentType, JobStatus, WeatherSensitivity, EquipmentStatus, CounterType, ComplianceType,
  ScanAction, WorkOrderSource, WorkOrderStatus, PermitType, PermitStatus, InspectionType,
  InspectionStatus, ReinspectionChannel, RenewalPattern, CoverageType, LienWaiverType,
  LienWaiverStatus, IncidentType, IncidentSeverity,
} from '../../lib/enums';
import type { SeedClock } from './clock';
import type { CoreSeed } from './core';

export async function seedFieldRecords(prisma: PrismaClient, clock: SeedClock, core: CoreSeed) {
  const { daysFromNow, daysAgo } = clock;
  const { cedarHollow, harborPoint, orchardRidge, mapleCrossing, lakeview, salvadorElectric, choPlumbing, walt, dale, marcus, priya, ollie, teo, renata, bigSam, jules, renee, kenji } = core;
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

}
