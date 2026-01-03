// components/admin/HallOfFameAdmin.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function normalize(e, idx) {
  return {
    id: String(e?.id || idx || uid()),
    year: Number.isFinite(Number(e?.year)) ? Number(e.year) : "",
    title: String(e?.title || ""),
    subtitle: String(e?.subtitle || ""),
    imageKey: String(e?.imageKey || ""),
    imageUrl: String(e?.imageUrl || ""),
    order: Number.isFinite(Number(e?.order)) ? Number(e.order) : idx + 1,
  };
}

export default function HallOfFameAdmin() {
  const season = CURRENT_SEASON;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function adminToken() {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const token = await adminToken();
      const res = await fetch(`/api/admin/hall-of-fame`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data?.entries) ? data.entries : [];
      const normalized = list.map(normalize);
      setEntries(normalized);

      // If R2 is empty, pull a one-time seed from Supabase so you can Save into R2.
      // This keeps Supabase usage limited to verification + the temporary seed.
      if (normalized.length === 0) {
        await seedFromSupabase();
      }
    } catch (e) {
      setErr(e?.message || "Failed to load Hall of Fame.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  async function seedFromSupabase() {
    try {
      const supabase = getSupabase();
      // Uses the logged-in admin session (no service role key, no server-side Supabase env usage)
      const { data, error } = await supabase
        .from("hall_of_fame")
        .select("id, year, title, blurb, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const seeded = Array.isArray(data)
        ? data.map((r, idx) =>
            normalize(
              {
                id: r.id,
                year: r.year,
                title: r.title,
                subtitle: r.blurb,
                imageUrl: r.image_url,
                order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
              },
              idx
            )
          )
        : [];

      if (seeded.length) {
        setEntries(seeded);
        setOk("Seeded from Supabase. Click Save to store in R2.");
      }
    } catch (e) {
      // If the Supabase table/permissions aren't available, just silently do nothing.
      // (Admin can still add entries manually.)
      console.warn("Hall of Fame seed failed:", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setEntry(id, patch) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    setOk("");
    setErr("");
    setEntries((prev) => [
      {
        id: uid(),
        year: season - 1,
        title: "",
        subtitle: "",
        imageKey: "",
        imageUrl: "",
        order: 1,
      },
      ...prev,
    ]);
  }

  function removeEntry(id) {
    setOk("");
    setErr("");
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function uploadImage(entryId, file) {
    setOk("");
    setErr("");
    if (!file) return;
    try {
      const token = await adminToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("section", "hall-of-fame-image");
      fd.append("season", String(season));
      fd.append("entryId", String(entryId));

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

      // store deterministic key (no extension in base key; upload returns key)
      setEntry(entryId, {
        imageKey: data.key || "",
        imageUrl: "",
      });
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    }
  }

  async function saveAll() {
    setOk("");
    setErr("");
    setSaving(true);
    try {
      const token = await adminToken();
      const payload = {
        entries: entries.map((e, idx) => normalize(e, idx)).sort((a, b) => a.order - b.order),
      };
      const res = await fetch("/api/admin/hall-of-fame", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setOk("Saved.");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="container-site space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="h2 text-primary">Hall of Fame</h1>
            <p className="text-muted text-sm mt-2">
              Data + images are stored in R2 (no Supabase tables/storage). Uploading an image overwrites the prior image
              for that entry.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" type="button" onClick={load} disabled={loading || saving}>
              Refresh
            </button>
            <button className="btn btn-outline" type="button" onClick={addEntry} disabled={loading || saving}>
              + Add
            </button>
            <button className="btn btn-primary" type="button" onClick={saveAll} disabled={loading || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {err ? <div className="card bg-rose-500/10 border border-rose-400/20 p-4 text-rose-100">{err}</div> : null}
        {ok ? <div className="card bg-emerald-500/10 border border-emerald-400/20 p-4 text-emerald-100">{ok}</div> : null}

        {loading ? (
          <div className="card bg-card-surface border border-subtle p-6 text-muted">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="card bg-card-surface border border-subtle p-6 text-muted">No entries yet.</div>
        ) : (
          <div className="grid gap-4">
            {entries.map((e) => {
              const safeKey = e.imageKey ? String(e.imageKey).replace(/^\/+/, "") : "";
              const src = safeKey ? `/r2/${safeKey}` : e.imageUrl || "";
              return (
                <div key={e.id} className="card bg-card-surface border border-subtle p-5 rounded-2xl">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="w-full lg:w-[320px]">
                      <div className="relative w-full h-[180px] rounded-xl overflow-hidden border border-subtle bg-black/20">
                        {src ? <Image src={src} alt={e.title || "Hall of Fame"} fill className="object-cover" /> : null}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="btn btn-outline cursor-pointer">
                          Upload image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(ev) => uploadImage(e.id, ev.target.files?.[0])}
                          />
                        </label>
                        <button className="btn btn-outline" type="button" onClick={() => removeEntry(e.id)}>
                          Remove
                        </button>
                      </div>
                      {e.imageKey ? <div className="mt-2 text-xs text-muted break-all">R2: {e.imageKey}</div> : null}
                    </div>

                    <div className="flex-1 grid gap-3">
                      <div className="grid sm:grid-cols-3 gap-3">
                        <label className="block">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted mb-1">Year</div>
                          <input
                            className="input"
                            value={e.year}
                            onChange={(ev) => setEntry(e.id, { year: ev.target.value })}
                            placeholder="2024"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted mb-1">Title</div>
                          <input
                            className="input"
                            value={e.title}
                            onChange={(ev) => setEntry(e.id, { title: ev.target.value })}
                            placeholder="League Winner"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted mb-1">Subtitle</div>
                        <input
                          className="input"
                          value={e.subtitle}
                          onChange={(ev) => setEntry(e.id, { subtitle: ev.target.value })}
                          placeholder="Team name / note"
                        />
                      </label>

                      
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
