'use client';

import { useEffect, useState } from 'react';
import type { NwsForecastResult } from '@/lib/weather/nws';
import type { ClimatologicalOutlook } from '@/lib/weather/outlook';

interface WeatherResponse {
  forecast: { data: NwsForecastResult | null; fetchedAt: string | null; stale: boolean; error: string | null };
  outlook: { data: ClimatologicalOutlook | null; fetchedAt: string | null; stale: boolean; error: string | null };
}

export function WeatherPanel({ jobId }: { jobId: string }) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force: boolean) => {
    force ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetch(`/api/weather/${jobId}`, { method: force ? 'POST' : 'GET' });
      const data = (await res.json()) as WeatherResponse;
      setWeather(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (loading) {
    return <div className="card text-sm text-zinc-500">Loading forecast…</div>;
  }

  const forecast = weather?.forecast;
  const outlook = weather?.outlook;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Weather risk</h3>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded-md border border-outdoor-border px-3 py-1.5 text-xs font-medium hover:bg-outdoor-surface disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {/* Layer 1: real forecast */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span className="font-medium uppercase tracking-wide">7-day forecast (National Weather Service)</span>
          <span>
            {forecast?.fetchedAt ? `Updated ${timeAgo(forecast.fetchedAt)}` : 'Not yet fetched'}
            {forecast?.stale && ' · showing last known data'}
          </span>
        </div>
        {forecast?.error && !forecast.data && (
          <p className="text-sm text-red-700">Could not reach the forecast service: {forecast.error}</p>
        )}
        {forecast?.data && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {forecast.data.periods.slice(0, 6).map((p) => (
              <div key={p.startTime} className="min-w-[110px] rounded-md border border-outdoor-border p-2 text-center">
                <div className="text-xs font-medium text-zinc-600">{p.name}</div>
                <div className="text-lg font-bold">{p.temperature}°{p.temperatureUnit}</div>
                <div className="text-xs text-zinc-500">{p.shortForecast}</div>
                {p.probabilityOfPrecipitation !== null && (
                  <div className="mt-1 text-xs text-blue-700">{p.probabilityOfPrecipitation}% precip</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layer 2: climatological outlook — visually distinct, explicitly not a forecast */}
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
          <span className="font-medium uppercase tracking-wide">Seasonal outlook — historical normals, not a forecast</span>
          {outlook?.fetchedAt && <span>Updated {timeAgo(outlook.fetchedAt)}</span>}
        </div>
        {outlook?.error && !outlook.data && (
          <p className="text-sm text-red-700">Could not reach the climate data service: {outlook.error}</p>
        )}
        {outlook?.data && (
          <p className="text-sm text-zinc-700">
            Based on {outlook.data.yearsOfHistory} years of history for {outlook.data.windowLabel}: typical highs around{' '}
            <strong>{Math.round(celsiusToF(outlook.data.averageHighC))}°F</strong>, lows around{' '}
            <strong>{Math.round(celsiusToF(outlook.data.averageLowC))}°F</strong>, with measurable precipitation on about{' '}
            <strong>{Math.round(outlook.data.precipitationDayFraction * 100)}%</strong> of days in this window historically.
            This is a climatological average, not a prediction for any specific day.
          </p>
        )}
      </div>
    </div>
  );
}

function celsiusToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
