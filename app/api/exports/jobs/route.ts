import { getDb } from '@/lib/db';
import { csvResponse } from '@/lib/csv';

export async function GET() {
  const prisma = await getDb();
  const jobs = await prisma.job.findMany({ orderBy: { startDate: 'asc' } });
  return csvResponse('jobs.csv',
    ['Job','Address','Status','Start date','Target end date','Weather sensitivity','Division','Certified payroll required'],
    jobs.map((j) => [j.name,j.address,j.status,j.startDate,j.targetEndDate,j.weatherSensitivity,j.division ?? '',j.certifiedPayrollRequired]),
  );
}
