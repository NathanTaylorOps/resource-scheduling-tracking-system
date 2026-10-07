import type { PrismaClient } from '@prisma/client';
import type { ImportKind, ImportIssue } from './import-validation';

export async function findImportDuplicates(
  prisma: PrismaClient,
  kind: ImportKind,
  records: Array<Record<string, string>>,
): Promise<ImportIssue[]> {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();

  if (kind === 'workers') {
    const existing = await prisma.worker.findMany({ select: { name: true, trade: true, hireDate: true } });
    const keys = new Set(existing.map((w) => workerKey(w.name, w.trade, w.hireDate)));
    records.forEach((r, i) => check(keys, seen, workerKey(r.name!, r.trade!, new Date(r.hireDate!)), i, issues, 'crew member'));
  } else if (kind === 'jobs') {
    const existing = await prisma.job.findMany({ select: { name: true, address: true, startDate: true } });
    const keys = new Set(existing.map((j) => jobKey(j.name, j.address, j.startDate)));
    records.forEach((r, i) => check(keys, seen, jobKey(r.name!, r.address!, new Date(r.startDate!)), i, issues, 'job'));
  } else {
    const existing = await prisma.equipment.findMany({ select: { name: true, category: true, acquisitionDate: true } });
    const keys = new Set(existing.map((e) => equipmentKey(e.name, e.category, e.acquisitionDate)));
    records.forEach((r, i) => check(keys, seen, equipmentKey(r.name!, r.category!, new Date(r.acquisitionDate!)), i, issues, 'asset'));
  }
  return issues;
}

function norm(value: string): string { return value.trim().toLocaleLowerCase('en-US'); }
function day(value: Date): string { return value.toISOString().slice(0, 10); }
function workerKey(name: string, trade: string, date: Date) { return `${norm(name)}|${norm(trade)}|${day(date)}`; }
function jobKey(name: string, address: string, date: Date) { return `${norm(name)}|${norm(address)}|${day(date)}`; }
function equipmentKey(name: string, category: string, date: Date) { return `${norm(name)}|${norm(category)}|${day(date)}`; }

function check(existing: Set<string>, seen: Set<string>, key: string, index: number, issues: ImportIssue[], label: string) {
  if (existing.has(key)) issues.push({ row: index + 2, message: `Possible duplicate ${label} already exists.` });
  else if (seen.has(key)) issues.push({ row: index + 2, message: `Duplicate ${label} appears earlier in this CSV.` });
  seen.add(key);
}
