"use client";

import { useEffect, useState } from "react";
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

// NOTE: Mini-Leagues is intentionally mostly hard-coded.
// Only the Hero "Updated" pill + the Updates HTML + Promo image should be editable.
// (Divisions/Leagues remain editable in the other tab.)
const DEFAULT_PAGE = {
  season: SEASON,
  hero: {
    updatedText: "Updated: 01/23/2025",
    promoImageKey: "", // R2 key (preferred)
    promoImageUrl: "/photos/minileagues-v2.webp", // fallback
    updatesHtml: "<p>Updates will show here.</p>",
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
  // Many platform errors return an HTML page; keep the admin UI from printing raw markup.
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
  if (text.trim().startsWith("<"))
    return `Request failed (${res.status}). See Cloudflare Pages function logs for details.`;
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
  return res.json(); // { ok, key, url }
}

export default function MiniLeaguesAdminClient() {
  const [tab, setTab] = useState("page"); // "page" | "divisions"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE);
  const [divisions, setDivisions] = useState([]);

  const promoPreview = pageCfg?.hero?.promoImageKey
    ? `/r2/${pageCfg.hero.promoImageKey}`
    : pageCfg?.hero?.promoImageUrl;

  async function loadAll() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const page = await apiGET("page");
      const pageData = page?.data || null;

      // Only merge the editable hero fields.
      setPageCfg({
        ...DEFAULT_PAGE,
        hero: {
          ...DEFAULT_PAGE.hero,
          updatedText: pageData?.hero?.updatedText ?? DEFAULT_PAGE.hero.updatedText,
          promoImageKey: pageData?.hero?.promoImageKey ?? "",
          updatesHtml: pageData?.hero?.updatesHtml ?? DEFAULT_PAGE.hero.updatesHtml,
        },
      });

      const div = await apiGET("divisions");
      const raw = div?.data;
      const list = Array.isArray(raw?.divisions) ? raw.divisions : Array.isArray(raw) ? raw : [];
      setDivisions(list.length ? list : [emptyDivision("100"), emptyDivision("200"), emptyDivision("400")]);
    } catch (e) {
      setErr(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function savePage() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      // Only persist what is supposed to be editable.
      const payload = {
        season: SEASON,
        hero: {
          updatedText: String(pageCfg?.hero?.updatedText || "").slice(0, 200),
          promoImageKey: String(pageCfg?.hero?.promoImageKey || ""),
          updatesHtml: String(pageCfg?.hero?.updatesHtml || ""),
        },
      };

      await apiPUT("page", payload);
      setOk("Saved Mini-Leagues Hero updates.");
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

  const canSave = !saving && !loading;

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
                  Mini-Leagues <span className="text-primary">Editor</span>
                </h1>
                <p className="text-sm text-muted">
                  Mini-Leagues is mostly hard-coded. This admin page only edits the Hero updates + promo image, and the Divisions/Leagues grid.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-outline" href="/mini-leagues">View Page</Link>
                <button className="btn btn-outline" type="button" onClick={loadAll} disabled={!canSave}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setTab("page")}
                className={`btn ${tab === "page" ? "btn-primary" : "btn-outline"}`}
              >
                Hero Updates
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
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
              Loading…
            </div>
          ) : tab === "page" ? (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-4">
                <h2 className="text-xl font-semibold text-primary">Hero Updates</h2>

                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 text-sm text-muted">
                  <p className="font-semibold text-fg">This editor is intentionally limited.</p>
                  <p className="mt-1">
                    You can only update the <span className="text-fg">Updated</span> pill text, the{" "}
                    <span className="text-fg">Updates HTML</span> block, and the{" "}
                    <span className="text-fg">Promo image</span>.
                  </p>
                </div>

                <label className="block text-sm text-muted">Updated text</label>
                <input
                  className="input w-full"
                  value={pageCfg.hero.updatedText}
                  onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatedText: e.target.value } }))}
                />

                <label className="block text-sm text-muted">Updates (HTML allowed)</label>
                <textarea
                  className="input w-full min-h-[160px]"
                  value={pageCfg.hero.updatesHtml}
                  onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))}
                />

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-muted">Promo image</div>
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
                        setOk("Uploaded promo image.");
                      } catch (ex) {
                        setErr(ex?.message || "Upload failed.");
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </div>

                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                  <Image src={promoPreview} alt="Promo preview" fill className="object-cover" />
                </div>

                <button className="btn btn-primary w-full" type="button" onClick={savePage} disabled={!canSave}>
                  {saving ? "Saving…" : "Save Hero Updates"}
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-2">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Divisions</h2>
                    <p className="text-sm text-muted">Each division has 10 leagues. Status: full / filling / tbd / drafting.</p>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={saveDivisions} disabled={!canSave}>
                    {saving ? "Saving…" : "Save Divisions"}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {divisions.map((d, divIdx) => {
                  const divPreview = d.imageKey ? `/r2/${d.imageKey}` : d.imageUrl || "";
                  return (
                    <div key={d.divisionCode} className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-subtle space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <label className="block text-xs uppercase tracking-[0.18em] text-muted">Division Title</label>
                            <input
                              className="input w-full"
                              value={d.title}
                              onChange={(e) => updateDivision(divIdx, { title: e.target.value })}
                            />

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs uppercase tracking-[0.18em] text-muted">Status</label>
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
                                <label className="block text-xs uppercase tracking-[0.18em] text-muted">Order</label>
                                <input
                                  className="input w-full"
                                  inputMode="numeric"
                                  value={d.order ?? ""}
                                  onChange={(e) => updateDivision(divIdx, { order: Number(e.target.value || 0) })}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs uppercase tracking-[0.18em] text-muted">Division Image</div>
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
                            {divPreview ? (
                              <div className="relative h-14 w-14 rounded-xl overflow-hidden border border-subtle bg-black/20">
                                <Image src={divPreview} alt={`${d.title} preview`} fill className="object-cover" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Leagues (10)</h3>

                        <div className="space-y-4">
                          {(Array.isArray(d.leagues) ? d.leagues : []).map((l, leagueIdx) => {
                            const leaguePreview = l.imageKey ? `/r2/${l.imageKey}` : l.imageUrl || "";
                            return (
                              <div key={`${d.divisionCode}-${leagueIdx}`} className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 space-y-3">
                                <div className="grid gap-3 md:grid-cols-[1.2fr_1.6fr_.7fr_.5fr_auto] items-end">
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Name</label>
                                    <input
                                      className="input w-full"
                                      value={l.name || ""}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { name: e.target.value })}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">URL</label>
                                    <input
                                      className="input w-full"
                                      value={l.url || ""}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { url: e.target.value })}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Status</label>
                                    <select
                                      className="input w-full"
                                      value={l.status || "tbd"}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { status: e.target.value })}
                                    >
                                      {STATUS_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Order</label>
                                    <input
                                      className="input w-full"
                                      inputMode="numeric"
                                      value={l.order ?? ""}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { order: Number(e.target.value || 0) })}
                                    />
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div>
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Image</div>
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
                                      <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-subtle bg-black/20">
                                        <Image src={leaguePreview} alt="League preview" fill className="object-cover" />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <label className="inline-flex items-center gap-2 text-sm text-muted">
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
                  );
                })}
              </div>

              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setDivisions((prev) => [...prev, emptyDivision(String((prev.length + 1) * 100))])}
                >
                  + Add Division
                </button>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
