import { weatherStatusFrom, type ComponentStatus } from '@/lib/domain/readiness';
import { checkWeatherSensitivity, type NwsForecastResult } from '@/lib/weather/nws';
import type { WeatherSensitivity } from '@/lib/enums';

export function evaluateWeatherReadiness(input: {
  weatherSensitivity: string;
  forecastCache: { dataJson: string; staleAfter: Date } | null;
  now: Date;
}): { status: ComponentStatus; reason?: string } {
  const fresh = input.forecastCache !== null && input.forecastCache.staleAfter.getTime() > input.now.getTime();
  let status: ComponentStatus;
  if (input.weatherSensitivity === 'INSENSITIVE') status = 'ok';
  else if (!fresh) status = 'unknown';
  else {
    const forecast = JSON.parse(input.forecastCache!.dataJson) as NwsForecastResult;
    const check = checkWeatherSensitivity(forecast, input.weatherSensitivity as WeatherSensitivity);
    status = weatherStatusFrom({
      hasSevereRiskInForecastWindow: check.atRisk && input.weatherSensitivity === 'SENSITIVE',
      hasModerateRiskInForecastWindow: check.atRisk && input.weatherSensitivity === 'CONDITIONAL',
    });
  }
  return {
    status,
    reason: status === 'unknown'
      ? "No forecast cached for this job yet — open it, or wait for the next session refresh, to check it."
      : status !== 'ok' ? 'The forecast shows weather risk for this job in the coming days.' : undefined,
  };
}
