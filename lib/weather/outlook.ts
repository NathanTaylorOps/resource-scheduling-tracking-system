/**
 * Layer 2 of the weather-risk overlay: what's honest to say about weather
 * beyond the real forecast window.
 *
 * Forecast skill for a specific day's temperature or rain chance is
 * essentially gone past 10-14 days out — a predictability limit, not a data
 * problem. NOAA's own Climate Prediction Center outlooks never predict a
 * specific day that far out; they express a probability of above/near/below
 * -normal conditions against a 30-year climatology. This module follows the
 * same discipline using a different, simpler-to-implement data source:
 * actual historical daily observations for the job's coordinates, averaged
 * over the same calendar-day window across recent years.
 *
 * This is NOT a scrape of NOAA CPC's own outlook product — CPC publishes
 * GIS/text products, not a simple JSON API. It is a climatological normal
 * computed from real historical weather data (Open-Meteo's free archive
 * API, no key required), which is the same underlying concept CPC outlooks
 * are benchmarked against. The UI must never render this as a day-specific
 * forecast — see the second, visually distinct panel in components/WeatherPanel.tsx.
 */

export interface ClimatologicalOutlook {
  fetchedAt: string;
  windowLabel: string;
  yearsOfHistory: number;
  averageHighC: number;
  averageLowC: number;
  precipitationDayFraction: number; // fraction of days in this window with measurable precipitation, historically
}

/**
 * Computes a climatological normal for the ~14 calendar days surrounding
 * `targetDate`, using the last `years` years of daily observations at the
 * given coordinates.
 */
export async function fetchClimatologicalOutlook(
  latitude: number,
  longitude: number,
  targetDate: Date,
  years = 10,
): Promise<ClimatologicalOutlook> {
  const endYear = targetDate.getUTCFullYear() - 1;
  const startYear = endYear - years + 1;

  const month = targetDate.getUTCMonth() + 1;
  const day = targetDate.getUTCDate();

  // Open-Meteo's archive API takes a single start/end date range per
  // request; to sample "this calendar window across N years" cheaply, pull
  // one full historical year range and filter to the +/-7 day window
  // client-side rather than issuing N separate narrow requests.
  const start = `${startYear}-01-01`;
  const end = `${endYear}-12-31`;

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo archive fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  const dates: string[] = data?.daily?.time ?? [];
  const highs: number[] = data?.daily?.temperature_2m_max ?? [];
  const lows: number[] = data?.daily?.temperature_2m_min ?? [];
  const precip: number[] = data?.daily?.precipitation_sum ?? [];

  const windowHighs: number[] = [];
  const windowLows: number[] = [];
  let rainyDays = 0;
  let totalDays = 0;

  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i] + 'T00:00:00Z');
    const withinWindow = isWithinDayOfYearWindow(d.getUTCMonth() + 1, d.getUTCDate(), month, day, 7);
    if (!withinWindow) continue;

    totalDays++;
    if (typeof highs[i] === 'number') windowHighs.push(highs[i]);
    if (typeof lows[i] === 'number') windowLows.push(lows[i]);
    if ((precip[i] ?? 0) >= 1) rainyDays++;
  }

  return {
    fetchedAt: new Date().toISOString(),
    windowLabel: `±7 days around ${targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, last ${years} years`,
    yearsOfHistory: years,
    averageHighC: average(windowHighs),
    averageLowC: average(windowLows),
    precipitationDayFraction: totalDays > 0 ? rainyDays / totalDays : 0,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** True when (month, day) falls within +/- windowDays of (targetMonth, targetDay), wrapping across year boundaries. */
function isWithinDayOfYearWindow(
  month: number,
  day: number,
  targetMonth: number,
  targetDay: number,
  windowDays: number,
): boolean {
  const toOrdinal = (m: number, d: number) => m * 31 + d; // coarse but adequate for a +/-7 day window check
  const diff = Math.abs(toOrdinal(month, day) - toOrdinal(targetMonth, targetDay));
  return diff <= windowDays || diff >= 12 * 31 - windowDays;
}
