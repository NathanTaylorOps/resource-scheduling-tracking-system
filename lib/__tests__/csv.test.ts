import { csvCell, toCsv } from '../csv';

let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  passed++;
}

assertEqual(csvCell('Smith, John'), '"Smith, John"', 'quotes commas');
assertEqual(csvCell('He said "go"'), '"He said ""go"""', 'escapes quotes');
assertEqual(csvCell('=2+2'), '"\'=2+2"', 'neutralizes formula prefix');
assertEqual(csvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"', 'neutralizes plus formula prefix');
assertEqual(csvCell(null), '""', 'serializes null as empty cell');
assertEqual(
  toCsv(['Name', 'Note'], [['Alex', 'Line 1\nLine 2']]),
  '"Name","Note"\r\n"Alex","Line 1\nLine 2"\r\n',
  'serializes rows with CRLF boundaries',
);

console.log(`CSV tests: ${passed} passed, 0 failed`);
