// components/GauntletUpdateButton.jsx
"use client";

import { useState } from "react";

export default function GauntletUpdateButton() {
  const [status, setStatus] = useState(null); // "success" | "error" | null
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/gauntlet-rebuild", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        setStatus("error");
        console.error("Gauntlet rebuild error:", data);
      } else {
        setStatus("success");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
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

      {status === "success" && (
        <p className="text-xs text-green-500">
          Gauntlet Leg 3 rebuild triggered. GitHub Action is running.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-500">
          Something went wrong triggering the rebuild. Check GitHub Actions logs.
        </p>
      )}
    </div>
  );
}
