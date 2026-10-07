/**
 * Seed data for Coastwood Builders, a fictional vertically-integrated
 * custom-home GC operating in the Pacific Northwest. Every name, address,
 * and figure is invented for this demo.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { createSeedClock } from './seed/clock';
import { seedCore } from './seed/core';
import { seedEquipment } from './seed/equipment';
import { seedPermits } from './seed/permits';
import { seedFieldRecords } from './seed/field-records';

const prisma = new PrismaClient();

async function resetDemoData() {
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

}

async function main() {
  console.log('Seeding Coastwood Builders demo data...');
  const clock = createSeedClock();

  await resetDemoData();
  const core = await seedCore(prisma, clock);
  await seedEquipment(prisma, clock, core);
  await seedPermits(prisma, clock, core);
  await seedFieldRecords(prisma, clock, core);

  const { jobs, workers } = core;
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
