export type CsvTable = { headers: string[]; rows: string[][] };

export function parseCsv(input: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      if (cell.length !== 0) throw new Error('Unexpected quote in CSV field.');
      quoted = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trimEnd().replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  row.push(cell.trimEnd().replace(/\r$/, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...data] = rows;
  return { headers: headers.map((h) => h.trim()), rows: data };
}

export function recordsFromCsv(input: string): Array<Record<string, string>> {
  const { headers, rows } = parseCsv(input);
  if (headers.length === 0) return [];
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`Row ${index + 2} has ${row.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, i) => [header, row[i] ?? '']));
  });
}
