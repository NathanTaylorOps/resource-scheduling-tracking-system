'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Kind = 'workers' | 'jobs' | 'equipment';
type Preview = { totalRows: number; validRows: number; issues: Array<{ row: number; message: string }> };

const LABEL: Record<Kind,string> = { workers: 'Crew', jobs: 'Jobs', equipment: 'Equipment' };

export function CsvImportPanel({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function choose(file?: File) {
    setError(null); setDone(null); setPreview(null);
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    try {
      const response = await fetch(`/api/imports/preview?kind=${kind}`, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not preview CSV.');
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not preview CSV.'); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!preview || preview.issues.length || !csv) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/imports/commit?kind=${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'text/csv', 'X-Confirm-Import': 'yes' }, body: csv,
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.preview) setPreview(data.preview);
        throw new Error(data.error ?? 'Import failed.');
      }
      setDone(`Imported ${data.imported} ${LABEL[kind].toLowerCase()} record${data.imported === 1 ? '' : 's'}.`);
      setPreview(null); setCsv(''); setFilename('');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-zinc-600 hover:underline">Import CSV</button>;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-semibold">Import {LABEL[kind]}</h2><p className="text-xs text-zinc-500">Preview and validate before anything is written.</p></div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-900">Close</button>
      </div>
      <input type="file" accept=".csv,text/csv" onChange={(e) => void choose(e.target.files?.[0])} className="block w-full text-sm" />
      {busy && <p className="text-sm text-zinc-500">Checking {filename || 'file'}…</p>}
      {preview && (
        <div className="rounded-md border border-outdoor-border p-3 text-sm">
          <div className="font-medium">{preview.totalRows} rows · {preview.validRows} valid · {preview.issues.length} issues</div>
          {preview.issues.length > 0 && <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-red-700">{preview.issues.slice(0,50).map((i,n)=><li key={n}>Row {i.row}: {i.message}</li>)}</ul>}
          {preview.issues.length === 0 && preview.totalRows > 0 && (
            <button type="button" disabled={busy} onClick={() => void commit()} className="field-btn mt-3 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50">
              Confirm import of {preview.totalRows} records
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {done && <p role="status" className="text-sm font-medium text-green-700">{done}</p>}
    </div>
  );
}
