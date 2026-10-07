import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateImport, type ImportKind } from '@/lib/import-validation';
import { findImportDuplicates } from '@/lib/import-duplicates';

const KINDS = new Set<ImportKind>(['workers', 'jobs', 'equipment']);
const MAX_BYTES = 512 * 1024;

export async function POST(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') as ImportKind | null;
  if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: 'Choose workers, jobs, or equipment.' }, { status: 400 });
  if (request.headers.get('x-confirm-import') !== 'yes') {
    return NextResponse.json({ error: 'Import must be explicitly confirmed after preview.' }, { status: 428 });
  }

  const csv = await request.text();
  if (!csv.trim()) return NextResponse.json({ error: 'CSV file is empty.' }, { status: 400 });
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) return NextResponse.json({ error: 'CSV file exceeds the 512 KB import limit.' }, { status: 413 });

  try {
    const { preview, records } = validateImport(kind, csv);
    if (preview.issues.length) return NextResponse.json({ error: 'Import validation failed.', preview }, { status: 400 });

    const prisma = await getDb();
    const duplicates = await findImportDuplicates(prisma, kind, records);
    if (duplicates.length) {
      return NextResponse.json({
        error: 'Import contains possible duplicates. No records were written.',
        preview: { ...preview, validRows: preview.totalRows - new Set(duplicates.map((d) => d.row)).size, issues: duplicates },
      }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (kind === 'workers') {
        for (const r of records) await tx.worker.create({ data: {
          name: r.name!, trade: r.trade!, employmentType: 'DIRECT_EMPLOYEE', hireDate: new Date(r.hireDate!),
          phone: r.phone || null, email: r.email || null,
        } });
      } else if (kind === 'jobs') {
        for (const r of records) await tx.job.create({ data: {
          name: r.name!, address: r.address!, latitude: Number(r.latitude), longitude: Number(r.longitude),
          status: r.status!, startDate: new Date(r.startDate!), targetEndDate: new Date(r.targetEndDate!),
          weatherSensitivity: r.weatherSensitivity!,
        } });
      } else {
        const existing = await tx.equipment.findMany({ where: { qrCode: { startsWith: 'CW-EQ-' } }, select: { qrCode: true } });
        let next = existing.reduce((max, e) => {
          const match = e.qrCode.match(/^CW-EQ-(\d+)$/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1;
        for (const r of records) await tx.equipment.create({ data: {
          name: r.name!, category: r.category!, qrCode: `CW-EQ-${String(next++).padStart(4, '0')}`,
          status: r.status!, acquisitionDate: new Date(r.acquisitionDate!), inServiceDate: new Date(r.inServiceDate!),
        } });
      }
      return records.length;
    });

    return NextResponse.json({ imported: created, kind }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed. No records were written.' }, { status: 400 });
  }
}
