import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { JobStatus, WeatherSensitivity } from '@/lib/enums';

interface CreateJobBody {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status?: string;
  startDate: string;
  targetEndDate: string;
  weatherSensitivity?: string;
}

/**
 * Creates a new job. latitude/longitude are entered by hand rather than
 * geocoded from the address — there's no geocoding provider wired into this
 * app (see the create form's own note), and both the weather layers
 * (lib/weather/nws.ts, lib/weather/outlook.ts) and the map (/map) depend on
 * a real coordinate pair, so this can't default to a placeholder the way an
 * optional field could.
 */
export async function POST(request: NextRequest) {
  let body: CreateJobBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Enter a job name.' }, { status: 400 });
  }
  const address = body.address?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Enter a job address.' }, { status: 400 });
  }
  if (typeof body.latitude !== 'number' || Number.isNaN(body.latitude) || body.latitude < -90 || body.latitude > 90) {
    return NextResponse.json({ error: 'Enter a valid latitude, between -90 and 90.' }, { status: 400 });
  }
  if (typeof body.longitude !== 'number' || Number.isNaN(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    return NextResponse.json({ error: 'Enter a valid longitude, between -180 and 180.' }, { status: 400 });
  }
  const startDate = new Date(body.startDate);
  const targetEndDate = new Date(body.targetEndDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(targetEndDate.getTime())) {
    return NextResponse.json({ error: 'Enter valid start and target-completion dates.' }, { status: 400 });
  }
  if (targetEndDate.getTime() <= startDate.getTime()) {
    return NextResponse.json({ error: 'Target completion must be after the start date.' }, { status: 400 });
  }
  const status = body.status && Object.values(JobStatus).includes(body.status as JobStatus) ? body.status : JobStatus.PLANNING;
  const weatherSensitivity =
    body.weatherSensitivity && Object.values(WeatherSensitivity).includes(body.weatherSensitivity as WeatherSensitivity)
      ? body.weatherSensitivity
      : WeatherSensitivity.CONDITIONAL;

  const job = await prisma.job.create({
    data: { name, address, latitude: body.latitude, longitude: body.longitude, status, startDate, targetEndDate, weatherSensitivity },
  });

  return NextResponse.json({ id: job.id }, { status: 201 });
}
