'use client';

import dynamic from 'next/dynamic';
import type { MapJob } from './JobMap';

// Leaflet reads `window` as soon as it's imported, so it can only ever run
// on the client. next/dynamic's ssr:false has to be requested from inside
// a Client Component boundary like this one — the App Router refuses it if
// called directly from the server page that renders the map.
const JobMap = dynamic(() => import('./JobMap').then((mod) => mod.JobMap), {
  ssr: false,
  loading: () => (
    <div className="card flex h-[560px] items-center justify-center text-sm text-zinc-500">Loading map…</div>
  ),
});

export function JobMapLoader({ jobs }: { jobs: MapJob[] }) {
  return <JobMap jobs={jobs} />;
}
