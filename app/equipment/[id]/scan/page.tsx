import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { JobStatus } from '@prisma/client';
import { EquipmentScanForm } from '@/components/EquipmentScanForm';

export const dynamic = 'force-dynamic';

/**
 * Landing page for a resolved QR scan (or a manually entered tag code —
 * params.id accepts either the equipment's id or its printed qrCode, same
 * as the equipment detail page). This is deliberately a thin server shell:
 * it resolves the asset and pulls the pick-lists, then hands off to the
 * client form that actually records the scan.
 */
export default async function EquipmentScanActionPage({ params }: { params: { id: string } }) {
  const equipment = await prisma.equipment.findFirst({
    where: { OR: [{ id: params.id }, { qrCode: params.id }] },
  });
  if (!equipment) notFound();

  const [jobs, workers, currentJob, currentWorker] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: [JobStatus.PLANNING, JobStatus.ACTIVE] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.worker.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    equipment.currentJobId
      ? prisma.job.findUnique({ where: { id: equipment.currentJobId }, select: { name: true } })
      : null,
    equipment.currentWorkerId
      ? prisma.worker.findUnique({ where: { id: equipment.currentWorkerId }, select: { name: true } })
      : null,
  ]);

  const custodyLabel = currentJob
    ? `checked out to ${currentJob.name}`
    : currentWorker
    ? `with ${currentWorker.name}`
    : equipment.locationNote
    ? equipment.locationNote.toLowerCase()
    : 'in storage';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href={`/equipment/${equipment.id}`} className="text-sm text-zinc-500 hover:underline">
        ← {equipment.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{equipment.name}</h1>
        <p className="text-sm text-zinc-500">
          {equipment.qrCode} · currently {custodyLabel}
        </p>
      </div>

      <EquipmentScanForm equipmentId={equipment.id} jobs={jobs} workers={workers} />
    </div>
  );
}
