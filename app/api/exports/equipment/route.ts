import { getDb } from '@/lib/db';
import { csvResponse } from '@/lib/csv';

export async function GET() {
  const prisma = await getDb();
  const [equipment, jobs] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: 'asc' } }),
    prisma.job.findMany({ select: { id: true, name: true } }),
  ]);
  const jobNames = new Map(jobs.map((j) => [j.id, j.name]));
  return csvResponse('equipment.csv',
    ['Asset','Category','QR code','Status','Current job','Location note','Acquisition date','In-service date'],
    equipment.map((e) => [e.name,e.category,e.qrCode,e.status,e.currentJobId ? jobNames.get(e.currentJobId) ?? '' : '',e.locationNote ?? '',e.acquisitionDate,e.inServiceDate]),
  );
}
