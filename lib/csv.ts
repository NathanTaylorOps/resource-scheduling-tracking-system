/**
 * Small RFC-4180-style CSV serializer for operational exports.
 *
 * Values are always quoted so commas, quotes and line breaks in names,
 * addresses or notes cannot corrupt the file. Text beginning with a
 * spreadsheet formula trigger is prefixed with an apostrophe before
 * quoting; exported business data should never become executable formula
 * input merely because somebody opens the CSV in Excel or Sheets.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function csvResponse(filename: string, headers: string[], rows: unknown[][]): Response {
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
