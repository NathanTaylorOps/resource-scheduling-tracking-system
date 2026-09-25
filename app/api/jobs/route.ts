import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { JobStatus, WeatherSensitivity } from '@/lib/enums';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, requiredDate, requiredCoordinates, optionalEnum, ValidationError } from '@/lib/validate';

/**
 * Creates a new job. latitude/longitude are entered by hand rather than
 * geocoded from the address — there's no geocoding provider wired into this
 * app (see the create form's own note), and both the weather layers
 * (lib/weather/nws.ts, lib/weather/outlook.ts) and the map (/map) depend on
 * a real coordinate pair, so this can't default to a placeholder the way an
 * optional field could.
 */
export async function POST(request: NextRequest) {
  try {
    const prisma = getDb();
    const body = await parseJsonBody(request);

    const name = requiredString(body, 'name', 'Enter a job name.');
    const address = requiredString(body, 'address', 'Enter a job address.');
    const { latitude, longitude } = requiredCoordinates(body);
    const startDate = requiredDate(body, 'startDate', 'Enter valid start and target-completion dates.');
    const targetEndDate = requiredDate(body, 'targetEndDate', 'Enter valid start and target-completion dates.');
    if (targetEndDate.getTime() <= startDate.getTime()) {
      throw new ValidationError('Target completion must be after the start date.');
    }
    const status = optionalEnum(body, 'status', JobStatus, JobStatus.PLANNING, 'Select a valid job status.');
    const weatherSensitivity = optionalEnum(
      body,
      'weatherSensitivity',
      WeatherSensitivity,
      WeatherSensitivity.CONDITIONAL,
      'Select a valid weather sensitivity.',
    );

    const job = await prisma.job.create({
      data: { name, address, latitude, longitude, status, startDate, targetEndDate, weatherSensitivity },
    });

    return NextResponse.json({ id: job.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
