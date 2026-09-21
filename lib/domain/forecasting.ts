/**
 * Usage-rate forecasting for maintenance planning.
 *
 * This is deliberately arithmetic, not machine learning: a rolling usage rate
 * projected forward against a known interval. That is a defensible, explainable
 * "predictive" feature that doesn't need failure-labeled training data to be
 * trustworthy — unlike a real failure-prediction model, which this project does
 * not attempt to build (see the maintenance module's roadmap notes).
 */

export interface UsageSample {
  date: Date;
  counterValue: number;
}

/**
 * Computes a rolling daily usage rate from a window of counter readings
 * (odometer, engine hours, cycle counts). Returns 0 when there isn't enough
 * history to project from, rather than guessing.
 */
export function computeDailyUsageRate(samples: UsageSample[]): number {
  if (samples.length < 2) return 0;

  const sorted = [...samples].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const elapsedDays = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
  if (elapsedDays <= 0) return 0;

  const usedUnits = last.counterValue - first.counterValue;
  return usedUnits > 0 ? usedUnits / elapsedDays : 0;
}

/**
 * Projects how many days remain until a usage-based due point is reached,
 * given the current counter value and a rolling daily usage rate.
 *
 * Returns null when the rate is zero or negative — an idle asset has no
 * meaningful usage-based forecast, and reporting one would be false precision.
 */
export function forecastDaysUntilDue(
  dueValue: number,
  currentValue: number,
  dailyUsageRate: number,
): number | null {
  if (dailyUsageRate <= 0) return null;

  const remaining = dueValue - currentValue;
  if (remaining <= 0) return 0;

  return remaining / dailyUsageRate;
}

/**
 * Hybrid trigger resolution: for a maintenance plan governed by both a calendar
 * date and a usage projection, the plan is due at whichever comes first —
 * mirroring how OEM service manuals are written ("every 6 months or 250 hours,
 * whichever occurs first").
 */
export function resolveHybridDueDate(
  calendarDueDate: Date,
  usageForecastDays: number | null,
  now: Date,
): Date {
  if (usageForecastDays === null) return calendarDueDate;

  const usageDueDate = new Date(now.getTime() + usageForecastDays * 24 * 60 * 60 * 1000);
  return usageDueDate < calendarDueDate ? usageDueDate : calendarDueDate;
}

export type ForecastBucket = '0-30' | '31-60' | '61-90' | 'beyond';

/**
 * Buckets a due date into the rolling 30/60/90-day forecast windows used by
 * the maintenance due-list view.
 */
export function bucketForecast(dueDate: Date, now: Date): ForecastBucket {
  const daysOut = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOut <= 30) return '0-30';
  if (daysOut <= 60) return '31-60';
  if (daysOut <= 90) return '61-90';
  return 'beyond';
}
