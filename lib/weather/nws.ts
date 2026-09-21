/**
 * Layer 1 of the weather-risk overlay: a real, live 7-day forecast from the
 * National Weather Service. This is the window where numerical weather
 * prediction is genuinely skillful — see lib/weather/outlook.ts for why
 * everything beyond it is handled completely differently.
 *
 * NWS is a two-step API: resolve a lat/lng to a forecast grid endpoint,
 * then fetch that endpoint for the actual periods. No API key is required,
 * but NWS asks every client to send an identifying User-Agent.
 */

export interface ForecastPeriod {
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation: number | null;
  windSpeed: string;
  shortForecast: string;
  detailedForecast: string;
}

export interface NwsForecastResult {
  fetchedAt: string;
  periods: ForecastPeriod[];
}

function userAgent(): string {
  return process.env.NWS_USER_AGENT ?? 'resource-scheduling-tracking-system (set NWS_USER_AGENT in .env)';
}

/**
 * Fetches the current 7-day/12-hour-period forecast for a lat/lng. Throws
 * on failure rather than silently returning stale or empty data — the
 * caller (the weather API route) is responsible for deciding what a failed
 * refresh should show against the last cached value.
 */
export async function fetchNwsForecast(latitude: number, longitude: number): Promise<NwsForecastResult> {
  const headers = { 'User-Agent': userAgent(), Accept: 'application/geo+json' };

  const pointsRes = await fetch(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, {
    headers,
  });
  if (!pointsRes.ok) {
    throw new Error(`NWS points lookup failed: ${pointsRes.status} ${pointsRes.statusText}`);
  }
  const points = await pointsRes.json();
  const forecastUrl: string | undefined = points?.properties?.forecast;
  if (!forecastUrl) {
    throw new Error('NWS points response did not include a forecast URL');
  }

  const forecastRes = await fetch(forecastUrl, { headers });
  if (!forecastRes.ok) {
    throw new Error(`NWS forecast fetch failed: ${forecastRes.status} ${forecastRes.statusText}`);
  }
  const forecast = await forecastRes.json();
  const periods = (forecast?.properties?.periods ?? []) as Array<Record<string, unknown>>;

  return {
    fetchedAt: new Date().toISOString(),
    periods: periods.map((p) => ({
      name: String(p.name ?? ''),
      startTime: String(p.startTime ?? ''),
      isDaytime: Boolean(p.isDaytime),
      temperature: Number(p.temperature ?? 0),
      temperatureUnit: String(p.temperatureUnit ?? 'F'),
      probabilityOfPrecipitation:
        (p.probabilityOfPrecipitation as { value: number | null } | undefined)?.value ?? null,
      windSpeed: String(p.windSpeed ?? ''),
      shortForecast: String(p.shortForecast ?? ''),
      detailedForecast: String(p.detailedForecast ?? ''),
    })),
  };
}

export interface WeatherSensitivityCheck {
  atRisk: boolean;
  reason: string | null;
}

/**
 * Flags a weather-sensitive job against the live forecast window using
 * simple, named thresholds rather than a vague "bad weather" judgment —
 * the field-service pattern the design research identified (rainfall over
 * X inches, wind over Y mph) rather than an opaque risk score.
 */
export function checkWeatherSensitivity(
  forecast: NwsForecastResult,
  sensitivity: 'INSENSITIVE' | 'CONDITIONAL' | 'SENSITIVE',
): WeatherSensitivityCheck {
  if (sensitivity === 'INSENSITIVE') return { atRisk: false, reason: null };

  const precipThreshold = sensitivity === 'SENSITIVE' ? 40 : 60;
  const windThreshold = sensitivity === 'SENSITIVE' ? 20 : 30;

  for (const period of forecast.periods.slice(0, 6)) {
    if ((period.probabilityOfPrecipitation ?? 0) >= precipThreshold) {
      return { atRisk: true, reason: `${period.probabilityOfPrecipitation}% chance of precipitation ${period.name.toLowerCase()}` };
    }
    const windMatch = period.windSpeed.match(/(\d+)/);
    const windMph = windMatch ? Number(windMatch[1]) : 0;
    if (windMph >= windThreshold) {
      return { atRisk: true, reason: `Wind forecast at ${period.windSpeed} ${period.name.toLowerCase()}` };
    }
  }

  return { atRisk: false, reason: null };
}
