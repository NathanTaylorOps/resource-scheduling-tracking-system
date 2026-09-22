import type { PrismaClient } from '@prisma/client';
import { fetchNwsForecast } from './nws';
import { fetchClimatologicalOutlook } from './outlook';

/**
 * Shared refresh-on-view cache logic for both weather layers. Originally
 * lived only in app/api/weather/[jobId]/route.ts; pulled out here so
 * lib/db.ts can call the exact same caching behavior to warm every job's
 * cache right after a new visitor's session database is provisioned (see
 * warmAllJobsWeather below) — the API route and the warm-up now share one
 * implementation instead of two copies that could drift.
 */

export const FORECAST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — matches how often a real NWS forecast actually updates
export const OUTLOOK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — climatological normals don't move fast enough to refresh hourly

export interface LayerResult<T> {
  data: T | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export async function refreshLayer<T>(
  prisma: PrismaClient,
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

/**
 * Warms both weather layers for every job in this visitor's freshly
 * provisioned database, fire-and-forget, right after their session copy is
 * created (see lib/db.ts). Without this, WeatherCache starts out empty for
 * every new visitor — since the weather component of a job's readiness
 * reads only from that cache (see computeJobReadiness in
 * lib/readiness-service.ts), and nothing else ever populates it except a
 * visitor opening that one job's own detail page — every job read as
 * "weather: not yet checked" on the dashboard, /jobs, and /field for the
 * entirety of a fresh visitor's session unless they happened to click into
 * every single job individually first. Best-effort and per-job isolated:
 * one job's forecast fetch failing (a bad lat/lng, NWS being down) must
 * never stop the rest of this visitor's jobs from warming.
 */
export async function warmAllJobsWeather(prisma: PrismaClient): Promise<void> {
  const jobs = await prisma.job.findMany({ select: { id: true, latitude: true, longitude: true } });
  await Promise.allSettled(
    jobs.map((job) =>
      Promise.allSettled([
        refreshLayer(prisma, job.id, 'FORECAST', FORECAST_TTL_MS, false, () =>
          fetchNwsForecast(job.latitude, job.longitude),
        ),
        refreshLayer(prisma, job.id, 'OUTLOOK', OUTLOOK_TTL_MS, false, () =>
          fetchClimatologicalOutlook(job.latitude, job.longitude, new Date()),
        ),
      ]),
    ),
  );
}
