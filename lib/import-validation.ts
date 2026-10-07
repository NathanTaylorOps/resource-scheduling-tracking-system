import { recordsFromCsv } from '@/lib/csv-import';

export type ImportKind = 'workers' | 'jobs' | 'equipment';
export type ImportIssue = { row: number; message: string };
export type ImportPreview = { kind: ImportKind; totalRows: number; validRows: number; issues: ImportIssue[] };

const REQUIRED: Record<ImportKind, string[]> = {
  workers: ['name', 'trade', 'employmentType', 'hireDate'],
  jobs: ['name', 'address', 'latitude', 'longitude', 'status', 'startDate', 'targetEndDate', 'weatherSensitivity'],
  equipment: ['name', 'category', 'status', 'acquisitionDate', 'inServiceDate'],
};

const ALLOWED: Record<ImportKind, Set<string>> = {
  workers: new Set([...REQUIRED.workers, 'phone', 'email']),
  jobs: new Set(REQUIRED.jobs),
  equipment: new Set(REQUIRED.equipment),
};

const ENUMS = {
  employmentType: new Set(['DIRECT_EMPLOYEE']),
  jobStatus: new Set(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETE']),
  sensitivity: new Set(['INSENSITIVE', 'CONDITIONAL', 'SENSITIVE']),
  equipmentStatus: new Set(['ACTIVE', 'IDLE', 'IN_TRANSIT', 'DOWN_FOR_SERVICE', 'RETIRED']),
};

export function validateImport(kind: ImportKind, csv: string): { preview: ImportPreview; records: Array<Record<string, string>> } {
  const records = recordsFromCsv(csv);
  const headers = records.length ? Object.keys(records[0]!) : firstLineHeaders(csv);
  const issues: ImportIssue[] = [];

  for (const required of REQUIRED[kind]) if (!headers.includes(required)) issues.push({ row: 1, message: `Missing required column "${required}".` });
  for (const header of headers) if (!ALLOWED[kind].has(header)) issues.push({ row: 1, message: `Unexpected column "${header}".` });

  records.forEach((record, index) => {
    const row = index + 2;
    for (const required of REQUIRED[kind]) if (!record[required]?.trim()) issues.push({ row, message: `${required} is required.` });
    if (kind === 'workers') validateWorker(record, row, issues);
    if (kind === 'jobs') validateJob(record, row, issues);
    if (kind === 'equipment') validateEquipment(record, row, issues);
  });

  const badRows = new Set(issues.filter((i) => i.row > 1).map((i) => i.row));
  const headerError = issues.some((i) => i.row === 1);
  return {
    preview: { kind, totalRows: records.length, validRows: headerError ? 0 : records.length - badRows.size, issues },
    records,
  };
}

function validDate(value: string | undefined): boolean {
  return !!value && !Number.isNaN(new Date(value).getTime());
}
function validateWorker(r: Record<string,string>, row: number, issues: ImportIssue[]) {
  if (r.employmentType && !ENUMS.employmentType.has(r.employmentType)) issues.push({ row, message: 'employmentType must be DIRECT_EMPLOYEE. Subcontractor workers require an existing firm and must be added individually.' });
  if (r.hireDate && !validDate(r.hireDate)) issues.push({ row, message: 'hireDate is not a valid date.' });
}
function validateJob(r: Record<string,string>, row: number, issues: ImportIssue[]) {
  const lat = Number(r.latitude), lng = Number(r.longitude);
  if (r.latitude && (!Number.isFinite(lat) || lat < -90 || lat > 90)) issues.push({ row, message: 'latitude must be between -90 and 90.' });
  if (r.longitude && (!Number.isFinite(lng) || lng < -180 || lng > 180)) issues.push({ row, message: 'longitude must be between -180 and 180.' });
  if (r.status && !ENUMS.jobStatus.has(r.status)) issues.push({ row, message: 'status is invalid.' });
  if (r.weatherSensitivity && !ENUMS.sensitivity.has(r.weatherSensitivity)) issues.push({ row, message: 'weatherSensitivity is invalid.' });
  if (r.startDate && !validDate(r.startDate)) issues.push({ row, message: 'startDate is not a valid date.' });
  if (r.targetEndDate && !validDate(r.targetEndDate)) issues.push({ row, message: 'targetEndDate is not a valid date.' });
  if (validDate(r.startDate) && validDate(r.targetEndDate) && new Date(r.targetEndDate) <= new Date(r.startDate)) issues.push({ row, message: 'targetEndDate must be after startDate.' });
}
function validateEquipment(r: Record<string,string>, row: number, issues: ImportIssue[]) {
  if (r.status && !ENUMS.equipmentStatus.has(r.status)) issues.push({ row, message: 'status is invalid.' });
  if (r.acquisitionDate && !validDate(r.acquisitionDate)) issues.push({ row, message: 'acquisitionDate is not a valid date.' });
  if (r.inServiceDate && !validDate(r.inServiceDate)) issues.push({ row, message: 'inServiceDate is not a valid date.' });
  if (validDate(r.acquisitionDate) && validDate(r.inServiceDate) && new Date(r.inServiceDate) < new Date(r.acquisitionDate)) issues.push({ row, message: 'inServiceDate cannot be before acquisitionDate.' });
}
function firstLineHeaders(csv: string): string[] {
  const first = csv.split(/\r?\n/, 1)[0] ?? '';
  return first.split(',').map((h) => h.replace(/^"|"$/g, '').trim()).filter(Boolean);
}
