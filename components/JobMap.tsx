'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import type { ComponentStatus } from '@/lib/domain/readiness';

export interface MapJob {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  overall: ComponentStatus;
}

// Reuses the exact status color tokens defined once in tailwind.config.ts
// (the same ones StatusBadge draws its dot from) rather than a second,
// hand-picked set of hex values that could quietly drift out of sync.
const STATUS_MARKER_CLASS: Record<ComponentStatus, string> = {
  ok: 'bg-status-ok',
  warning: 'bg-status-warning',
  blocked: 'bg-status-blocked',
};

function markerIcon(status: ComponentStatus) {
  return L.divIcon({
    className: '',
    html: `<span class="block h-[18px] w-[18px] rounded-full border-2 border-white shadow-md ${STATUS_MARKER_CLASS[status]}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/**
 * Multi-site view of every active or upcoming job. A marker's color is the
 * same overall-readiness verdict shown on the dashboard and job detail
 * pages — crew, equipment, compliance, and weather rolled into the worst
 * of the four — so a GM scanning the map sees exactly what they'd see
 * scanning the job list, just laid out geographically.
 */
export function JobMap({ jobs }: { jobs: MapJob[] }) {
  if (jobs.length === 0) {
    return <div className="card text-sm text-zinc-500">No active or upcoming jobs to plot.</div>;
  }

  const center: [number, number] = [
    jobs.reduce((sum, job) => sum + job.latitude, 0) / jobs.length,
    jobs.reduce((sum, job) => sum + job.longitude, 0) / jobs.length,
  ];

  return (
    <div className="card overflow-hidden p-0">
      <MapContainer center={center} zoom={9} scrollWheelZoom style={{ height: '560px', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {jobs.map((job) => (
          <Marker key={job.id} position={[job.latitude, job.longitude]} icon={markerIcon(job.overall)}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{job.name}</div>
                <div className="text-xs text-zinc-500">{job.address}</div>
                <Link href={`/jobs/${job.id}`} className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline">
                  View job →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
