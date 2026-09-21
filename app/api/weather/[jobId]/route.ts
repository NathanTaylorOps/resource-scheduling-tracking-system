import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchNwsForecast } from '@/lib/weather/nws';
import { fetchClimatologicalOutlook } from '@/lib/weather/outlook';

const FORECAST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — matches how often a real NWS forecast actually updates
const OUTLOOK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — climatological normals don't move fast enough to refresh hourly

/**
 * Refresh-on-view weather: GET returns the cached layers, refreshing
 * whichever is stale; POST forces a refresh of both regardless of
 * staleness (the dashboard's "Refresh now" button). Deliberately not a
 * background cron job — see the architecture notes in the README for why.
 */
export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  return handle(params.jobId, false);
}

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  return handle(params.jobId, true);
}

async function handle(jobId: string, force: boolean) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const [forecast, outlook] = await Promise.all([
    refreshLayer(jobId, 'FORECAST', FORECAST_TTL_MS, force, () => fetchNwsForecast(job.latitude, job.longitude)),
    refreshLayer(jobId, 'OUTLOOK', OUTLOOK_TTL_MS, force, () =>
      fetchClimatologicalOutlook(job.latitude, job.longitude, new Date()),
    ),
  ]);

  return NextResponse.json({ forecast, outlook });
}

interface LayerResult<T> {
  data: T | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

async function refreshLayer<T>(
  jobId: string,
  layer: 'FORECAST' | 'OUTLOOK',
  ttlMs: number,
  force: boolean,
  fetcher: () => Promise<T>,
): Promise<LayerResult<T>> {
  const existing = await prisma.weatherCache.findUnique({ where: { jobId_layer: { jobId, layer } } });
  const isStale = !existing || existing.staleAfter < new Date();

  if (!force && existing && !isStale) {
    return { data: JSON.parse(existing.dataJson) as T, fetchedAt: existing.fetchedAt.toISOString(), stale: false, error: null };
  }

  try {
    const fresh = await fetcher();
    await prisma.weatherCache.upsert({
      where: { jobId_layer: { jobId, layer } },
      create: { jobId, layer, dataJson: JSON.stringify(fresh), staleAfter: new Date(Date.now() + ttlMs) },
      update: { dataJson: JSON.stringify(fresh), fetchedAt: new Date(), staleAfter: new Date(Date.now() + ttlMs) },
    });
    return { data: fresh, fetchedAt: new Date().toISOString(), stale: false, error: null };
  } catch (err) {
    // A failed live fetch falls back to whatever is cached, clearly marked
    // stale, rather than showing nothing — a PM checking a job before
    // sending a crew out should see "last known forecast, 9 hours old" over
    // a blank panel.
    if (existing) {
      return {
        data: JSON.parse(existing.dataJson) as T,
        fetchedAt: existing.fetchedAt.toISOString(),
        stale: true,
        error: err instanceof Error ? err.message : 'Weather refresh failed',
      };
    }
    return { data: null, fetchedAt: null, stale: true, error: err instanceof Error ? err.message : 'Weather refresh failed' };
  }
}
