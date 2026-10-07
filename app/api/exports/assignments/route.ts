import { getDb } from '@/lib/db';
import { csvResponse } from '@/lib/csv';

export async function GET() {
  const prisma = await getDb();
  const assignments = await prisma.assignment.findMany({
    include: { worker: { select: { name: true } }, job: { select: { name: true } } },
    orderBy: { start: 'asc' },
  });
  return csvResponse('assignments.csv',
    ['Worker','Job','Role','Start','End'],
    assignments.map((a) => [a.worker.name,a.job.name,a.roleOnJob,a.start,a.end]),
  );
}
