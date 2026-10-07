/**
 * Database-backed integration coverage for the operational workflows that
 * cross schema, persistence, and domain boundaries.
 *
 * CI creates a throwaway SQLite database before this file runs. Each case
 * creates its own records and removes them in dependency-safe order.
 */
import { PrismaClient } from '@prisma/client';
import { evaluateAssignmentGate } from '../domain/certifications';
import { findEquipmentConflicts } from '../domain/equipment';
import { evaluatePermitReadiness } from '../readiness/permits';
import { evaluateEquipmentReadiness } from '../readiness/equipment';
import { computeReadiness } from '../domain/readiness';

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${label}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL  ${label}`);
    console.error(error);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date();
const day = 24 * 60 * 60 * 1000;
const date = (offset: number) => new Date(now.getTime() + offset * day);

async function createJob(name: string) {
  return prisma.job.create({
    data: {
      name,
      address: '100 Integration Test Way, Seattle, WA',
      latitude: 47.6,
      longitude: -122.3,
      status: 'ACTIVE',
      startDate: date(-1),
      targetEndDate: date(30),
      weatherSensitivity: 'INSENSITIVE',
    },
  });
}

async function cleanup() {
  await prisma.inspection.deleteMany({ where: { permit: { job: { name: { startsWith: 'IT —' } } } } });
  await prisma.permit.deleteMany({ where: { job: { name: { startsWith: 'IT —' } } } });
  await prisma.equipmentReservation.deleteMany({ where: { job: { name: { startsWith: 'IT —' } } } });
  await prisma.assignment.deleteMany({ where: { job: { name: { startsWith: 'IT —' } } } });
  await prisma.jobRoleRequirement.deleteMany({ where: { job: { name: { startsWith: 'IT —' } } } });
  await prisma.workerCertification.deleteMany({ where: { worker: { name: { startsWith: 'IT —' } } } });
  await prisma.worker.deleteMany({ where: { name: { startsWith: 'IT —' } } });
  await prisma.workOrder.deleteMany({ where: { equipment: { name: { startsWith: 'IT —' } } } });
  await prisma.equipment.deleteMany({ where: { name: { startsWith: 'IT —' } } });
  await prisma.job.deleteMany({ where: { name: { startsWith: 'IT —' } } });
}

async function main() {
  console.log('workflows.integration.test.ts — database-backed operational workflows');
  await cleanup();
  
  await check('persisted certification state gates assignment eligibility', async () => {
    const job = await createJob('IT — Certification gate');
    const worker = await prisma.worker.create({
      data: { name: 'IT — Electrician', trade: 'Electrician', employmentType: 'DIRECT_EMPLOYEE', hireDate: date(-300) },
    });
    await prisma.jobRoleRequirement.create({
      data: { jobId: job.id, roleOrTrade: 'Electrician', requiredCount: 1, requiredCertTypes: 'Electrical License' },
    });
    await prisma.workerCertification.create({
      data: { workerId: worker.id, certType: 'Electrical License', issuingBody: 'Test Authority', issueDate: date(-700), expiryDate: date(-1) },
    });
  
    const persisted = await prisma.worker.findUniqueOrThrow({ where: { id: worker.id }, include: { certifications: true } });
    const requirement = await prisma.jobRoleRequirement.findUniqueOrThrow({ where: { jobId_roleOrTrade: { jobId: job.id, roleOrTrade: 'Electrician' } } });
    const gate = evaluateAssignmentGate(requirement.requiredCertTypes, persisted.certifications, now);
    assert(!gate.eligible && gate.missingOrExpired.includes('Electrical License'), 'expired persisted certification should block assignment');
  });
  
  await check('persisted overlapping equipment reservations surface a conflict', async () => {
    const firstJob = await createJob('IT — Reservation A');
    const secondJob = await createJob('IT — Reservation B');
    const equipment = await prisma.equipment.create({
      data: { name: 'IT — Excavator', category: 'Earthmoving', qrCode: `IT-EQ-${Date.now()}`, status: 'ACTIVE', acquisitionDate: date(-500), inServiceDate: date(-490) },
    });
    await prisma.equipmentReservation.createMany({
      data: [
        { equipmentId: equipment.id, jobId: firstJob.id, start: date(2), end: date(8) },
        { equipmentId: equipment.id, jobId: secondJob.id, start: date(6), end: date(10) },
      ],
    });
  
    const rows = await prisma.equipmentReservation.findMany({ where: { equipmentId: equipment.id } });
    const conflicts = findEquipmentConflicts(rows);
    assert(conflicts.length === 1, `expected one persisted reservation conflict, got ${conflicts.length}`);
  });
  
  await check('failed persisted inspection blocks permit and overall readiness', async () => {
    const job = await createJob('IT — Failed inspection');
    const permit = await prisma.permit.create({
      data: {
        jobId: job.id, permitType: 'BUILDING', issuingAuthority: 'Test Authority', status: 'ISSUED', appliedDate: date(-20),
        inspections: { create: [{ inspectionType: 'FRAMING', sequence: 1, status: 'FAILED', completedDate: date(-1) }] },
      },
      include: { inspections: true },
    });
    const permitResult = evaluatePermitReadiness({ permits: [permit], now });
    const overall = computeReadiness({ crew: 'ok', equipment: 'ok', compliance: 'ok', weather: 'ok', permits: permitResult.status });
    assert(permitResult.status === 'blocked', 'failed inspection should block permit readiness');
    assert(overall.overall === 'blocked', 'blocked permit component should block overall readiness');
  });
  
  await check('persisted down-for-service asset blocks equipment and overall readiness', async () => {
    const job = await createJob('IT — Down equipment');
    const equipment = await prisma.equipment.create({
      data: {
        name: 'IT — Compressor', category: 'Air', qrCode: `IT-DOWN-${Date.now()}`, status: 'DOWN_FOR_SERVICE',
        acquisitionDate: date(-300), inServiceDate: date(-290), currentJobId: job.id,
      },
    });
    await prisma.workOrder.create({
      data: { equipmentId: equipment.id, source: 'DEFECT_REPORT', status: 'OPEN', description: 'Defect found during custody scan.' },
    });
  
    const persisted = await prisma.equipment.findUniqueOrThrow({ where: { id: equipment.id } });
    const equipmentResult = evaluateEquipmentReadiness({ jobId: job.id, onSiteEquipment: [persisted], reservations: [], reservedButDownForService: [] });
    const overall = computeReadiness({ crew: 'ok', equipment: equipmentResult.status, compliance: 'ok', weather: 'ok', permits: 'ok' });
    assert(equipmentResult.status === 'blocked', 'on-site down-for-service asset should block equipment readiness');
    assert(overall.overall === 'blocked', 'blocked equipment component should block overall readiness');
  });
  
  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
