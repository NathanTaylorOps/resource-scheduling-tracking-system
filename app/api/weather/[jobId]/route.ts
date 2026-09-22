import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchNwsForecast } from '@/lib/weather/nws';
import { fetchClimatologicalOutlook } from '@/lib/weather/outlook';
import { refreshLayer, FORECAST_TTL_MS, OUTLOOK_TTL_MS } from '@/lib/weather/cache';

/**
 * Refresh-on-view weather: GET returns the cached layers, refreshing
 * whichever is stale; POST forces a refresh of both regardless of
 * staleness (the dashboard's "Refresh now" button). Deliberately not a
 * background cron job — see the architecture notes in the README for why.
 * The actual cache/TTL/fallback logic lives in lib/weather/cache.ts, shared
 * with the session-provisioning warm-up in lib/db.ts.
 */
export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  return handle(params.jobId, false);
}

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  return handle(params.jobId, true);
}

async function handle(jobId: string, force: boolean) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const [forecast, outlook] = await Promise.all([
    refreshLayer(prisma, jobId, 'FORECAST', FORECAST_TTL_MS, force, () =>
      fetchNwsForecast(job.latitude, job.longitude),
    ),
    refreshLayer(prisma, jobId, 'OUTLOOK', OUTLOOK_TTL_MS, force, () =>
      fetchClimatologicalOutlook(job.latitude, job.longitude, new Date()),
    ),
  ]);

  return NextResponse.json({ forecast, outlook });
}
