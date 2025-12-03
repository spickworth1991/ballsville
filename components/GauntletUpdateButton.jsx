// components/GauntletUpdateButton.jsx
"use client";

import { useState } from "react";
import { getSupabase } from "@/src/lib/supabaseClient";

export default function GauntletUpdateButton({ lastUpdatedAt, onRefresh }) {
  const [status, setStatus] = useState("idle"); // idle | triggering | waiting | done | error | timeout
  const [loading, setLoading] = useState(false);

  function statusLabel() {
    switch (status) {
      case "triggering":
        return "Requested rebuild…";
      case "waiting":
        return "Rebuild running… watching for new scores.";
      case "done":
        return "Rebuild complete. Latest bracket loaded.";
      case "timeout":
        return "Rebuild was triggered, but no changes detected yet. Try Refresh.";
      case "error":
        return "Error triggering rebuild. Check console / GitHub Actions.";
      default:
        return null;
    }
  }

  async function pollForUpdate(oldTimestamp) {
    const supabase = getSupabase();
    const maxAttempts = 60; // safety cap
    const delayMs = 10_000; // 10s between checks

    const parseTs = (ts) => (ts ? new Date(ts).getTime() : null);
    const oldMs = parseTs(oldTimestamp);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((res) => setTimeout(res, delayMs));

      const { data, error } = await supabase
        .from("gauntlet_leg3")
        .select("updated_at")
        .eq("year", "2025")
        .maybeSingle();

      if (error) {
        console.error("Polling error while checking gauntlet_leg3:", error);
        continue;
      }
      if (!data?.updated_at) continue;

      const newMs = parseTs(data.updated_at);
      if (!oldMs || (newMs && newMs !== oldMs)) {
        return data.updated_at;
      }
    }

    return null; // never saw a change within attempts
  }

  async function handleClick() {
    setLoading(true);
    setStatus("triggering");

    try {
      const res = await fetch("/api/gauntlet-rebuild", {
        method: "POST",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.ok) {
        console.error("Gauntlet rebuild error:", body);
        setStatus("error");
        return;
      }

      // Successfully told GitHub to run. Now watch Supabase.
      setStatus("waiting");
      const newUpdatedAt = await pollForUpdate(lastUpdatedAt);

      if (newUpdatedAt) {
        setStatus("done");
        if (onRefresh) {
          await onRefresh(); // reload data on the page
        }
      } else {
        setStatus("timeout");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 rounded-md border border-[#d97f00] text-sm font-semibold
                   bg-[#d97f00] text-white hover:bg-[#f89a1c] disabled:opacity-60 disabled:cursor-not-allowed
                   shadow-sm transition"
      >
        {loading ? "Updating…" : "Update Leg 3 Bracket"}
      </button>

      {statusLabel() && (
        <p
          className={`text-xs ${
            status === "done"
              ? "text-green-400"
              : status === "error"
              ? "text-red-400"
              : status === "timeout"
              ? "text-amber-300"
              : "text-slate-300"
          }`}
        >
          {statusLabel()}
        </p>
      )}
    </div>
  );
}
