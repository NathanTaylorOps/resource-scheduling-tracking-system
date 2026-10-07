import { NextRequest, NextResponse } from 'next/server';
import { validateImport, type ImportKind } from '@/lib/import-validation';

const KINDS = new Set<ImportKind>(['workers', 'jobs', 'equipment']);
const MAX_BYTES = 512 * 1024;

export async function POST(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') as ImportKind | null;
  if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: 'Choose workers, jobs, or equipment.' }, { status: 400 });

  const csv = await request.text();
  if (!csv.trim()) return NextResponse.json({ error: 'CSV file is empty.' }, { status: 400 });
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) return NextResponse.json({ error: 'CSV file exceeds the 512 KB import limit.' }, { status: 413 });

  try {
    const { preview } = validateImport(kind, csv);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not parse CSV.' }, { status: 400 });
  }
}
