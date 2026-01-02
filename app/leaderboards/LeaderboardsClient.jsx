"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";

import Leaderboard from "./_lb/components/Leaderboard";
import { LeaderboardProvider } from "./_lb/context/LeaderboardContext";
import useAvailableYears from "./_lb/hooks/useAvailableYears";
import useR2Live from "./_lb/hooks/useR2Live";

const DEFAULT_YEAR = CURRENT_SEASON;

// Leaderboards JSONs live under: data/leaderboards/* in the R2 bucket.
// In production, always go through the Pages Function at /r2/*.
// In local dev (next dev), Pages Functions do NOT run, so we must hit the
// bucket's public r2.dev URL directly.
function getLeaderboardsR2Base() {
  // Optional override if you ever want to change it
  if (process.env.NEXT_PUBLIC_LEADERBOARDS_R2_PROXY_BASE) {
    return process.env.NEXT_PUBLIC_LEADERBOARDS_R2_PROXY_BASE; // e.g. "/r2" or full public URL
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // Local dev: use public bucket URL
    return (
      process.env.NEXT_PUBLIC_LEADERBOARDS_R2_PUBLIC_BASE ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ||
      "https://pub-153090242f5a4c0eb7bd0e499832a797.r2.dev"
    );
  }

  return "/r2";
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function stripUpdatedAt(obj) {
  if (!obj || typeof obj !== "object") return obj;
  // Avoid mutating the original object (hooks/cache)
  const out = { ...obj };
  delete out.updatedAt;
  return out;
}

function formatDateTime(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

export default function LeaderboardsClient() {
  // IMPORTANT: Client Components still render on the server for the initial HTML.
  // If we compute a different base URL on the client during hydration (e.g. localhost
  // choosing the public R2 dev domain), React will throw a hydration mismatch.
  // Start with "/r2" (server-safe) and then swap after mount.
  const [r2Base, setR2Base] = useState("/r2");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setR2Base(getLeaderboardsR2Base());
  }, []);

  const DATA_BASE = useMemo(() => {
    const b = String(r2Base || "/r2").replace(/\/$/, "");
    return `${b}/data/leaderboards`;
  }, [r2Base]);

  const { years, loading: yearsLoading } = useAvailableYears({
    basePath: DATA_BASE,
    fromYear: 2023,
    toYear: DEFAULT_YEAR,
  });

  const initialYear = useMemo(() => {
    // Prefer latest discovered year; fall back to current year
    if (Array.isArray(years) && years.length) return years[0];
    return DEFAULT_YEAR;
  }, [years]);

  // Navbar expects a { year: "2025", mode: "...", filterType, filterValue } object
  const [current, setCurrent] = useState(() => ({
    year: String(initialYear),
    mode: "",
    filterType: "all",
    filterValue: null,
  }));

  // Keep year synced with available years.
  useEffect(() => {
    setCurrent((c) => ({ ...c, year: String(initialYear) }));
  }, [initialYear]);

  const yearStr = current.year;

  // Weekly toggle lives in Navbar; Leaderboard reads it.
  const [showWeeks, setShowWeeks] = useState(false);

  // Live leaderboards (poll). The hook will optionally poll a weekly manifest
  // to detect changes, but the main payload is leaderboards_<year>.json.
  const { data: liveData, updatedAt, error: liveError, loading: liveLoading } = useR2Live(yearStr, {
    enabled: Boolean(yearStr),
    pollMs: 60_000,
    basePath: DATA_BASE,
  });

  // The leaderboards JSON is written as either:
  // 1) { "2025": { big_game: {...}, ... } }
  // 2) { big_game: {...}, ... }  (some generators strip the year wrapper)
  // Normalize so the UI always reads the per-year object.
  const rawYearBlock = useMemo(() => {
    if (!liveData) return null;
    const y = String(yearStr);
    const maybeWrapped =
      (liveData?.[y] && typeof liveData[y] === "object" ? liveData[y] : null) ||
      (liveData?.[Number(y)] && typeof liveData[Number(y)] === "object" ? liveData[Number(y)] : null);
    return maybeWrapped || (typeof liveData === "object" ? liveData : null);
  }, [liveData, yearStr]);

  // Keep updatedAt separate so it doesn't show up as a selectable "mode".
  const lastUpdated = useMemo(() => {
    // Prefer hook's updatedAt (from the payload) but fall back to rawYearBlock.updatedAt.
    const dt = updatedAt || rawYearBlock?.updatedAt;
    return dt ? formatDateTime(dt) : "";
  }, [updatedAt, rawYearBlock]);

  const yearBlock = useMemo(() => stripUpdatedAt(rawYearBlock), [rawYearBlock]);

  // Build a stable object for Navbar/Provider: { [year]: {modeA:..., modeB:...} }
  const lbData = useMemo(() => {
    if (!yearBlock) return {};
    return { [yearStr]: yearBlock };
  }, [yearBlock, yearStr]);

  // Ensure current.mode stays valid as data loads/changes.
  useEffect(() => {
    const modes = Object.keys(yearBlock || {}).filter((k) => yearBlock?.[k] && typeof yearBlock[k] === "object");
    if (!modes.length) return;
    if (current.mode && modes.includes(current.mode)) return;
    setCurrent((c) => ({ ...c, mode: modes[0] }));
  }, [yearBlock, current.mode]);

  const mode = current.mode;
  const leaderboardData = mode ? yearBlock?.[mode] || null : null;

  const leaderboardsUrl = `${DATA_BASE}/leaderboards_${yearStr}.json`;
  const weeklyManifestUrl = `${DATA_BASE}/weekly_manifest_${yearStr}.json`;

  const lbError = liveError;
  const lbLoading = liveLoading || (!lbError && Boolean(yearStr) && !liveData);

  // Avoid hydration mismatch for any text derived from r2Base.
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="rounded-lg border border-white/10 bg-black/10 p-6 text-sm">
            Loading leaderboards…
          </div>
        </main>
      </div>
    );
  }

  return (
    <LeaderboardProvider leaderboards={lbData}>
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
          {lbError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
              Failed to load leaderboards for {yearStr}.
              <br />
              {String(lbError)}
              <div className="mt-2 opacity-80">
                Expected JSON: <code>{leaderboardsUrl}</code>
                <div className="mt-1">
                  Expected weekly manifest: <code>{weeklyManifestUrl}</code>
                </div>
              </div>
            </div>
          ) : lbLoading || !leaderboardData ? (
            <div className="rounded-lg border border-white/10 bg-black/10 p-6 text-sm">
              Loading leaderboards…
            </div>
          ) : (
            <Leaderboard
              data={lbData}
              years={safeArray(years)}
              current={current}
              setCurrent={setCurrent}
              basePath={DATA_BASE}
              lastUpdated={lastUpdated}
              showWeeks={showWeeks}
              setShowWeeks={setShowWeeks}
            />
          )}
        </main>
      </div>
    </LeaderboardProvider>
  );
}
