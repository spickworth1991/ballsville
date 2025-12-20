// app/admin/mini-leagues/MiniLeaguesAdminClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/src/lib/supabaseClient";

const SEASON = 2025;

const STATUS_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "filling", label: "FILLING" },
  { value: "drafting", label: "DRAFTING" },
  { value: "full", label: "FULL" },
];

// ==============================
// ONLY THESE ARE EDITABLE IN CMS
// ==============================
const DEFAULT_PAGE_EDITABLE = {
  season: SEASON,
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/minileagues-v2.webp", // fallback if no key
    updatesHtml: "<p>Updates will show here.</p>",
  },
  winners: {
    title: "Last Year’s Winners",
    imageKey: "",
    imageUrl: "/photos/hall-of-fame/minileageus2024.png", // fallback
    // ✅ new second image slot
    imageKey2: "",
    imageUrl2: "",
    caption: "",
  },
};

function emptyDivision(code = "100") {
  return {
    divisionCode: String(code),
    title: `Division ${code}`,
    status: "tbd",
    order: Number(code) / 100,
    imageKey: "",
    imageUrl: "",
    leagues: Array.from({ length: 10 }).map((_, i) => ({
      name: `League ${i + 1}`,
      url: "",
      status: "tbd",
      active: true,
      order: i + 1,
      imageKey: "",
      imageUrl: "",
    })),
  };
}

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function readApiError(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.error || j?.message || JSON.stringify(j);
    }
  } catch {
    // fall through
  }
  const text = await res.text();
  if (!text) return `Request failed (${res.status})`;
  if (text.trim().startsWith("<")) return `Request failed (${res.status}). Check Cloudflare Pages function logs.`;
  return text;
}

async function apiGET(type) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${SEASON}&type=${type}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUT(type, data) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${SEASON}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, data }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function uploadImage(file, folder = "mini-leagues") {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

function StatusPill({ status }) {
  const label = (STATUS_OPTIONS.find((x) => x.value === status)?.label || "TBD").toUpperCase();
  const cls =
    status === "full"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
      : status === "filling"
      ? "bg-amber-500/15 text-amber-200 border-amber-400/20"
      : status === "drafting"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/20"
      : "bg-zinc-500/15 text-zinc-200 border-zinc-400/20";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function MiniLeaguesAdminClient() {
  const [tab, setTab] = useState("updates"); // "updates" | "divisions"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [divisions, setDivisions] = useState([]);

  // collapsible UI state
  const [openDivs, setOpenDivs] = useState(() => new Set()); // divisionCode set

  const updatesPreview = pageCfg?.hero?.promoImageKey ? `/r2/${pageCfg.hero.promoImageKey}` : pageCfg?.hero?.promoImageUrl;

  const winnersPreview1 = pageCfg?.winners?.imageKey ? `/r2/${pageCfg.winners.imageKey}` : pageCfg?.winners?.imageUrl;

  const winnersPreview2 = pageCfg?.winners?.imageKey2 ? `/r2/${pageCfg.winners.imageKey2}` : pageCfg?.winners?.imageUrl2;

  const divisionCount = divisions.length;
  const leagueCount = useMemo(() => {
    let n = 0;
    for (const d of divisions) n += Array.isArray(d.leagues) ? d.leagues.length : 0;
    return n;
  }, [divisions]);

  async function loadAll() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const page = await apiGET("page");
      const hero = page?.data?.hero || {};
      const winners = page?.data?.winners || {};

      setPageCfg({
        ...DEFAULT_PAGE_EDITABLE,
        hero: {
          ...DEFAULT_PAGE_EDITABLE.hero,
          promoImageKey: hero.promoImageKey ?? "",
          promoImageUrl: hero.promoImageUrl ?? DEFAULT_PAGE_EDITABLE.hero.promoImageUrl,
          updatesHtml: hero.updatesHtml ?? DEFAULT_PAGE_EDITABLE.hero.updatesHtml,
        },
        winners: {
          ...DEFAULT_PAGE_EDITABLE.winners,
          title: winners.title ?? DEFAULT_PAGE_EDITABLE.winners.title,
          caption: winners.caption ?? DEFAULT_PAGE_EDITABLE.winners.caption,
          imageKey: winners.imageKey ?? "",
          imageUrl: winners.imageUrl ?? DEFAULT_PAGE_EDITABLE.winners.imageUrl,
          // ✅ new
          imageKey2: winners.imageKey2 ?? "",
          imageUrl2: winners.imageUrl2 ?? DEFAULT_PAGE_EDITABLE.winners.imageUrl2,
        },
      });

      const div = await apiGET("divisions");
      const raw = div?.data;
      const list = Array.isArray(raw?.divisions) ? raw.divisions : Array.isArray(raw) ? raw : [];
      setDivisions(list.length ? list : [emptyDivision("100"), emptyDivision("200"), emptyDivision("400")]);

      // open first division by default if none open yet
      setOpenDivs((prev) => {
        if (prev.size) return prev;
        const s = new Set();
        const first = (list.length ? list : [emptyDivision("100")])[0];
        if (first?.divisionCode) s.add(String(first.divisionCode));
        return s;
      });
    } catch (e) {
      setErr(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveUpdatesAndWinners() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      await apiPUT("page", {
        season: SEASON,
        hero: {
          promoImageKey: pageCfg.hero.promoImageKey,
          promoImageUrl: pageCfg.hero.promoImageUrl,
          updatesHtml: pageCfg.hero.updatesHtml,
        },
        winners: {
          title: pageCfg.winners.title,
          caption: pageCfg.winners.caption,
          imageKey: pageCfg.winners.imageKey,
          imageUrl: pageCfg.winners.imageUrl,
          // ✅ new
          imageKey2: pageCfg.winners.imageKey2,
          imageUrl2: pageCfg.winners.imageUrl2,
        },
      });
      setOk("Saved Updates + Winners to R2.");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDivisions() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      await apiPUT("divisions", { season: SEASON, divisions });
      setOk("Saved divisions to R2.");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function updateDivision(idx, patch) {
    setDivisions((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function updateLeague(divIdx, leagueIdx, patch) {
    setDivisions((prev) =>
      prev.map((d, i) => {
        if (i !== divIdx) return d;
        const leagues = Array.isArray(d.leagues) ? d.leagues.slice() : [];
        leagues[leagueIdx] = { ...leagues[leagueIdx], ...patch };
        return { ...d, leagues };
      })
    );
  }

  function toggleDiv(code) {
    const key = String(code);
    setOpenDivs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setOpenDivs(new Set(divisions.map((d) => String(d.divisionCode))));
  }

  function collapseAll() {
    setOpenDivs(new Set());
  }

  function addDivision() {
    setDivisions((prev) => {
      const nextCode = String((prev.length + 1) * 100);
      const next = [...prev, emptyDivision(nextCode)];
      return next;
    });

    // open it
    setOpenDivs((prev) => {
      const next = new Set(prev);
      next.add(String((divisions.length + 1) * 100));
      return next;
    });
  }

  const canAct = !saving && !loading;

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">Admin</p>
                <h1 className="text-3xl font-semibold">
                  Mini-Leagues <span className="text-primary">CMS</span>
                </h1>
                <p className="text-sm text-muted">
                  Editable blocks: <strong>Updates</strong> (image + HTML) and <strong>Last Year’s Winners</strong> (1–2 images + title/caption), plus <strong>Divisions/Leagues</strong>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-outline" href="/mini-leagues">
                  View Page
                </Link>
                <button className="btn btn-outline" type="button" onClick={loadAll} disabled={!canAct}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setTab("updates")}
                className={`btn ${tab === "updates" ? "btn-primary" : "btn-outline"}`}
              >
                Updates + Winners
              </button>
              <button
                type="button"
                onClick={() => setTab("divisions")}
                className={`btn ${tab === "divisions" ? "btn-primary" : "btn-outline"}`}
              >
                Divisions & Leagues
              </button>
            </div>

            {err ? (
              <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-red-300">
                {err}
              </div>
            ) : null}
            {ok ? (
              <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-green-300">
                {ok}
              </div>
            ) : null}
          </header>

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
          ) : tab === "updates" ? (
            <section className="grid gap-6 lg:grid-cols-2">
              {/* UPDATES */}
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-4">
                <h2 className="text-xl font-semibold text-primary">Updates</h2>

                <label className="block text-sm text-muted">Updates (HTML allowed)</label>
                <textarea
                  className="input w-full min-h-[180px]"
                  value={pageCfg.hero.updatesHtml}
                  onChange={(e) =>
                    setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))
                  }
                />

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-muted">Updates image</div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setErr("");
                      setOk("");
                      try {
                        const up = await uploadImage(f, "mini-leagues");
                        setPageCfg((p) => ({ ...p, hero: { ...p.hero, promoImageKey: up.key } }));
                        setOk("Uploaded updates image.");
                      } catch (ex) {
                        setErr(ex?.message || "Upload failed.");
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </div>

                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                  <Image src={updatesPreview} alt="Updates preview" fill className="object-cover" />
                </div>

                <button className="btn btn-primary w-full" type="button" onClick={saveUpdatesAndWinners} disabled={!canAct}>
                  {saving ? "Saving…" : "Save Updates + Winners"}
                </button>
              </div>

              {/* WINNERS */}
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-4">
                <h2 className="text-xl font-semibold text-primary">Last Year’s Winners</h2>

                <label className="block text-sm text-muted">Section title</label>
                <input
                  className="input w-full"
                  value={pageCfg.winners.title}
                  onChange={(e) => setPageCfg((p) => ({ ...p, winners: { ...p.winners, title: e.target.value } }))}
                />

                <label className="block text-sm text-muted">Caption (optional)</label>
                <input
                  className="input w-full"
                  value={pageCfg.winners.caption}
                  onChange={(e) => setPageCfg((p) => ({ ...p, winners: { ...p.winners, caption: e.target.value } }))}
                />

                {/* ✅ Image uploads (1 and 2) */}
                <div className="pt-2 grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted">Winners image (1)</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setErr("");
                        setOk("");
                        try {
                          const up = await uploadImage(f, "mini-leagues");
                          setPageCfg((p) => ({ ...p, winners: { ...p.winners, imageKey: up.key } }));
                          setOk("Uploaded winners image (1).");
                        } catch (ex) {
                          setErr(ex?.message || "Upload failed.");
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted">Winners image (2) (optional)</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setErr("");
                        setOk("");
                        try {
                          const up = await uploadImage(f, "mini-leagues");
                          setPageCfg((p) => ({ ...p, winners: { ...p.winners, imageKey2: up.key } }));
                          setOk("Uploaded winners image (2).");
                        } catch (ex) {
                          setErr(ex?.message || "Upload failed.");
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>

                {/* ✅ Preview (1-up or 2-up) */}
                <div className="rounded-2xl border border-subtle bg-black/20 overflow-hidden p-4">
                  <div className={`w-full max-w-[980px] mx-auto grid gap-4 ${winnersPreview2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                    <div className="relative w-full h-[280px] sm:h-[340px]">
                      <Image src={winnersPreview1} alt="Winners preview (1)" fill className="object-contain" />
                    </div>

                    {winnersPreview2 ? (
                      <div className="relative w-full h-[280px] sm:h-[340px]">
                        <Image src={winnersPreview2} alt="Winners preview (2)" fill className="object-contain" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <button className="btn btn-outline w-full" type="button" onClick={saveUpdatesAndWinners} disabled={!canAct}>
                  {saving ? "Saving…" : "Save Updates + Winners"}
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              {/* Divisions header toolbar */}
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Divisions & Leagues</h2>
                    <p className="text-sm text-muted">
                      {divisionCount} divisions • {leagueCount} leagues • Status: full / filling / tbd / drafting
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-outline" type="button" onClick={expandAll} disabled={!canAct}>
                      Expand all
                    </button>
                    <button className="btn btn-outline" type="button" onClick={collapseAll} disabled={!canAct}>
                      Collapse all
                    </button>
                    <button className="btn btn-outline" type="button" onClick={addDivision} disabled={!canAct}>
                      + Add Division
                    </button>
                    <button className="btn btn-primary" type="button" onClick={saveDivisions} disabled={!canAct}>
                      {saving ? "Saving…" : "Save Divisions"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Divisions list (collapsible) */}
              <div className="space-y-4">
                {divisions
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((d, divIdx) => {
                    const isOpen = openDivs.has(String(d.divisionCode));
                    const divPreview = d.imageKey ? `/r2/${d.imageKey}` : d.imageUrl || "";

                    return (
                      <div key={d.divisionCode} className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
                        {/* Collapsible header */}
                        <button
                          type="button"
                          onClick={() => toggleDiv(d.divisionCode)}
                          className="w-full text-left p-5 border-b border-subtle hover:bg-subtle-surface/20 transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold text-primary truncate">{d.title}</h3>
                                <StatusPill status={d.status} />
                                <span className="text-xs text-muted">Order: {d.order ?? "—"}</span>
                              </div>
                              <p className="text-xs text-muted">
                                {Array.isArray(d.leagues) ? d.leagues.filter((x) => x.active !== false).length : 0} active leagues
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {divPreview ? (
                                <div className="relative h-11 w-11 rounded-xl overflow-hidden border border-subtle bg-black/20 shrink-0">
                                  <Image src={divPreview} alt={`${d.title} preview`} fill className="object-cover" />
                                </div>
                              ) : null}
                              <span className="text-xs text-muted">{isOpen ? "▼" : "►"}</span>
                            </div>
                          </div>
                        </button>

                        {/* Body */}
                        {isOpen ? (
                          <div className="p-5 space-y-4">
                            {/* Division controls */}
                            <div className="grid gap-3 md:grid-cols-[1.2fr_.7fr_.6fr_auto] items-end">
                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  Division Title
                                </label>
                                <input
                                  className="input w-full"
                                  value={d.title}
                                  onChange={(e) => updateDivision(divIdx, { title: e.target.value })}
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  Status
                                </label>
                                <select
                                  className="input w-full"
                                  value={d.status}
                                  onChange={(e) => updateDivision(divIdx, { status: e.target.value })}
                                >
                                  {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                  Order
                                </label>
                                <input
                                  className="input w-full"
                                  inputMode="numeric"
                                  value={d.order ?? ""}
                                  onChange={(e) => updateDivision(divIdx, { order: Number(e.target.value || 0) })}
                                />
                              </div>

                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                    Division Image
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      setErr("");
                                      setOk("");
                                      try {
                                        const up = await uploadImage(f, "mini-leagues");
                                        updateDivision(divIdx, { imageKey: up.key });
                                        setOk(`Uploaded image for ${d.title}.`);
                                      } catch (ex) {
                                        setErr(ex?.message || "Upload failed.");
                                      } finally {
                                        e.target.value = "";
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Leagues */}
                            <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                                  Leagues (10)
                                </h4>
                                <span className="text-xs text-muted">Tip: leave URL blank until league is ready.</span>
                              </div>

                              <div className="space-y-3">
                                {(Array.isArray(d.leagues) ? d.leagues : []).map((l, leagueIdx) => {
                                  const leaguePreview = l.imageKey ? `/r2/${l.imageKey}` : l.imageUrl || "";
                                  return (
                                    <div
                                      key={`${d.divisionCode}-${leagueIdx}`}
                                      className="rounded-2xl border border-subtle bg-card-surface p-4"
                                    >
                                      <div className="grid gap-3 md:grid-cols-[1.2fr_1.8fr_.7fr_.5fr_auto] items-end">
                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            Name
                                          </label>
                                          <input
                                            className="input w-full"
                                            value={l.name || ""}
                                            onChange={(e) => updateLeague(divIdx, leagueIdx, { name: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            URL
                                          </label>
                                          <input
                                            className="input w-full"
                                            value={l.url || ""}
                                            onChange={(e) => updateLeague(divIdx, leagueIdx, { url: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            Status
                                          </label>
                                          <select
                                            className="input w-full"
                                            value={l.status || "tbd"}
                                            onChange={(e) => updateLeague(divIdx, leagueIdx, { status: e.target.value })}
                                          >
                                            {STATUS_OPTIONS.map((o) => (
                                              <option key={o.value} value={o.value}>
                                                {o.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            Order
                                          </label>
                                          <input
                                            className="input w-full"
                                            inputMode="numeric"
                                            value={l.order ?? ""}
                                            onChange={(e) =>
                                              updateLeague(divIdx, leagueIdx, { order: Number(e.target.value || 0) })
                                            }
                                          />
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                              Image
                                            </div>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={async (e) => {
                                                const f = e.target.files?.[0];
                                                if (!f) return;
                                                setErr("");
                                                setOk("");
                                                try {
                                                  const up = await uploadImage(f, "mini-leagues");
                                                  updateLeague(divIdx, leagueIdx, { imageKey: up.key });
                                                  setOk(`Uploaded image for ${l.name || `League ${leagueIdx + 1}`}.`);
                                                } catch (ex) {
                                                  setErr(ex?.message || "Upload failed.");
                                                } finally {
                                                  e.target.value = "";
                                                }
                                              }}
                                            />
                                          </div>

                                          {leaguePreview ? (
                                            <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-subtle bg-black/20 shrink-0">
                                              <Image src={leaguePreview} alt="League preview" fill className="object-cover" />
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>

                                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
                                        <input
                                          type="checkbox"
                                          checked={l.active !== false}
                                          onChange={(e) => updateLeague(divIdx, leagueIdx, { active: e.target.checked })}
                                        />
                                        Active
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
