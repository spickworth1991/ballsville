// app/admin/dynasty/wagering/DynastyWageringAdminClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/src/lib/supabaseClient";
import { CURRENT_SEASON } from "@/src/lib/season";

const SEASON = CURRENT_SEASON;

const DEFAULT_TRACKER = {
  pot: 0,
  notes: "",
  // { username, amount }
  entries: [],
};

function clampNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sumPot(entries) {
  return (entries || []).reduce((acc, e) => {
    const n = Number(e?.amount);
    if (!Number.isFinite(n)) return acc;
    return acc + n;
  }, 0);
}

export default function DynastyWageringAdminClient() {
  const [tracker, setTracker] = useState(DEFAULT_TRACKER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const bust = useMemo(() => `v=${Date.now()}`, []);
  const computedPot = useMemo(() => sumPot(tracker.entries), [tracker.entries]);

  async function getToken() {
    const supabase = getSupabase();
    if (!supabase) return "";
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setErr("");
    setOkMsg("");
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/dynasty-wagering?season=${SEASON}&${bust}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setTracker({ ...DEFAULT_TRACKER, ...(data?.tracker || {}) });
    } catch (e) {
      setErr(e?.message || "Failed to load wagering tracker.");
      setTracker(DEFAULT_TRACKER);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setErr("");
    setOkMsg("");
    setSaving(true);
    try {
      const token = await getToken();
      const nextTracker = { ...tracker, pot: computedPot };
      const res = await fetch(`/api/admin/dynasty-wagering?season=${SEASON}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ season: SEASON, tracker: nextTracker }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setOkMsg("Saved.");
    } catch (e) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addEntry() {
    setTracker((t) => ({ ...t, entries: [...(t.entries || []), { username: "", amount: 0 }] }));
  }

  function updateEntry(i, patch) {
    setTracker((t) => {
      const next = [...(t.entries || [])];
      next[i] = { ...(next[i] || {}), ...patch };
      return { ...t, entries: next };
    });
  }

  function removeEntry(i) {
    setTracker((t) => {
      const next = [...(t.entries || [])];
      next.splice(i, 1);
      return { ...t, entries: next };
    });
  }

  if (loading) {
    return (
      <div className="card bg-card-surface border border-subtle p-6">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card bg-card-surface border border-subtle p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="h2 text-primary">Dynasty Wager Tracker</h1>
            <p className="text-muted text-sm">Stored in R2 for season {SEASON}.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" type="button" onClick={load} disabled={saving}>
              Refresh
            </button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {err ? <div className="text-sm text-red-300">{err}</div> : null}
        {okMsg ? <div className="text-sm text-emerald-200">{okMsg}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Pot</div>
            <input
              className="input w-full"
              type="number"
              value={computedPot}
              readOnly
            />
            <div className="text-xs text-muted">Auto-calculated from all wagers (amounts) below.</div>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Notes</div>
            <textarea
              className="input w-full min-h-[90px]"
              value={tracker.notes || ""}
              onChange={(e) => setTracker((t) => ({ ...t, notes: e.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="card bg-card-surface border border-subtle p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Entries</h2>
          <button className="btn btn-outline" type="button" onClick={addEntry}>
            + Add
          </button>
        </div>

        <div className="space-y-3">
          {(tracker.entries || []).length === 0 ? (
            <p className="text-sm text-muted">No entries yet.</p>
          ) : (
            (tracker.entries || []).map((row, i) => (
              <div key={i} className="rounded-2xl border border-subtle bg-card-trans p-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                <input
                  className="input"
                  placeholder="Username"
                  value={row.username || ""}
                  onChange={(e) => updateEntry(i, { username: e.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Amount"
                  value={row.amount ?? 0}
                  onChange={(e) => updateEntry(i, { amount: clampNum(e.target.value) })}
                />
                <button className="btn btn-outline" type="button" onClick={() => removeEntry(i)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
