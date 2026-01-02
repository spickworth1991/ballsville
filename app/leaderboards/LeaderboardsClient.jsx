"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "./_lb/components/Navbar";
import Leaderboard from "./_lb/components/Leaderboard";
import useAvailableYears from "./_lb/hooks/useAvailableYears";
import useR2Live from "./_lb/hooks/useR2Live";
import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_YEAR = CURRENT_SEASON

// R2 key base (served by Ballsville's existing /r2 proxy)
const DATA_BASE =
  process.env.NEXT_PUBLIC_LEADERBOARDS_DATA_BASE || "/r2/data/leaderboards";

export default function LeaderboardsClient() {
  const { years, loading: yearsLoading } = useAvailableYears({
    basePath: DATA_BASE,
    fromYear: 2021,
    toYear: DEFAULT_YEAR,
  });

  const initialYear = useMemo(() => {
    // Prefer latest discovered year; fall back to current year
    if (Array.isArray(years) && years.length) return years[0];
    return DEFAULT_YEAR;
  }, [years]);

  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    setYear(initialYear);
  }, [initialYear]);

  const leaderboardUrl = `${DATA_BASE}/leaderboards_${year}.json`;
  const manifestUrl = `${DATA_BASE}/weekly_manifest_${year}.json`;

  const {
    data: leaderboardData,
    loading: lbLoading,
    error: lbError,
    lastModified: lbLastModified,
  } = useR2Live(leaderboardUrl, {
    enabled: Boolean(year),
    pollMs: 60_000,
    initialDelayMs: 0,
  });

  const {
    data: weeklyManifest,
    lastModified: manifestLastModified,
  } = useR2Live(manifestUrl, {
    enabled: Boolean(year),
    pollMs: 60_000,
    initialDelayMs: 0,
  });

  const lastUpdated = useMemo(() => {
    const lm = lbLastModified || manifestLastModified;
    if (!lm) return null;
    try {
      return new Date(lm).toLocaleString();
    } catch {
      return String(lm);
    }
  }, [lbLastModified, manifestLastModified]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leaderboards</h1>
            <p className="text-sm opacity-80">
              Data source: R2 ({DATA_BASE})
              {lastUpdated ? ` • Updated ${lastUpdated}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Season</label>
            <select
              className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={yearsLoading || !years?.length}
            >
              {(years?.length ? years : [DEFAULT_YEAR]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lbError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
            Failed to load leaderboards for {year}.<br />
            {String(lbError)}
            <div className="mt-2 opacity-80">
              Expected JSON: <code>{leaderboardUrl}</code>
            </div>
          </div>
        ) : lbLoading || !leaderboardData ? (
          <div className="rounded-lg border border-white/10 bg-black/10 p-6 text-sm">
            Loading leaderboards…
          </div>
        ) : (
          <Leaderboard
            data={leaderboardData}
            year={year}
            // weeklyManifest is optional; the Leaderboard component can still render without it
            weeklyManifest={weeklyManifest}
            basePath={DATA_BASE}
          />
        )}
      </main>
    </div>
  );
}
