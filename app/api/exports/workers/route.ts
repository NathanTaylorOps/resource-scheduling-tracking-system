import { getDb } from '@/lib/db';
import { csvResponse } from '@/lib/csv';

export async function GET() {
  const prisma = await getDb();
  const workers = await prisma.worker.findMany({
    include: { subcontractor: { select: { businessName: true } }, certifications: true },
    orderBy: { name: 'asc' },
  });
  return csvResponse('crew.csv',
    ['Name','Trade','Employment type','Subcontractor','Hire date','Phone','Email','Certification count'],
    workers.map((w) => [w.name,w.trade,w.employmentType,w.subcontractor?.businessName ?? '',w.hireDate,w.phone ?? '',w.email ?? '',w.certifications.length]),
  );
}
