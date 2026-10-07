import { parseCsv, recordsFromCsv } from '../csv-import';
import { validateImport } from '../import-validation';

let passed = 0;
function ok(value: unknown, label: string) { if (!value) throw new Error(label); passed++; }
function eq(actual: unknown, expected: unknown, label: string) { if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`); passed++; }

const parsed = parseCsv('"name","note"\r\n"Alex","Line 1\nLine 2"\r\n');
eq(parsed.rows[0]?.[1], 'Line 1\nLine 2', 'quoted multiline field');
eq(recordsFromCsv('name,trade\nAlex,Carpenter\n')[0]?.trade, 'Carpenter', 'maps headers');

const workers = validateImport('workers', 'name,trade,employmentType,hireDate\nAlex,Carpenter,DIRECT_EMPLOYEE,2026-01-01\n');
eq(workers.preview.validRows, 1, 'valid worker row');
eq(workers.preview.issues.length, 0, 'valid worker has no issues');

const badJob = validateImport('jobs', 'name,address,latitude,longitude,status,startDate,targetEndDate,weatherSensitivity\nTest,Site,91,-122,ACTIVE,2026-05-02,2026-05-01,SENSITIVE\n');
ok(badJob.preview.issues.some((i) => i.message.includes('latitude')), 'rejects invalid latitude');
ok(badJob.preview.issues.some((i) => i.message.includes('after startDate')), 'rejects reversed job dates');

const subcontractor = validateImport('workers', 'name,trade,employmentType,hireDate\nSam,Electrical,SUBCONTRACTOR,2026-01-01\n');
ok(subcontractor.preview.issues.some((i) => i.message.includes('existing firm')), 'rejects ambiguous subcontractor bulk import');

console.log(`CSV import tests: ${passed} passed, 0 failed`);
