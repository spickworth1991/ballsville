"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/src/lib/supabaseClient";
import {
  MINI_LEAGUES_SEASON,
  miniLeaguesDefault,
  normalizeMiniLeaguesPayload,
  buildMiniLeaguesPublicModel,
} from "@/app/mini-leagues/content";

const TABS = [
  { key: "content", label: "Content" },
  { key: "divisions", label: "Divisions & Leagues" },
];

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function apiGet() {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${MINI_LEAGUES_SEASON}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPut(payload) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ season: MINI_LEAGUES_SEASON, data: payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function apiUploadImage(file) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/admin/mini-leagues/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
  return json; // { ok, url, key }
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function ensure10Leagues(div) {
  const leagues = Array.isArray(div.leagues) ? div.leagues : [];
  const out = leagues.slice(0, 10);
  while (out.length < 10) out.push({ name: "", url: "", status: "tbd", imagePath: "", active: true, order: out.length + 1 });
  return out;
}

export default function MiniLeaguesAdminClient() {
  const [tab, setTab] = useState("content");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [draft, setDraft] = useState(deepClone(miniLeaguesDefault));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      setMsg("");
      try {
        const json = await apiGet();
        const merged = normalizeMiniLeaguesPayload(json?.data || {});
        if (!cancelled) setDraft(deepClone(merged));
      } catch (e) {
        if (!cancelled) {
          setErr("Could not load Mini-Leagues data (showing defaults).");
          setDraft(deepClone(miniLeaguesDefault));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => buildMiniLeaguesPublicModel(draft), [draft]);

  async function onSave() {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      await apiPut(draft);
      setMsg("Saved to R2 ✅ (persists across deploys)");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function setField(path, value) {
    setDraft((prev) => {
      const next = deepClone(prev);
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        cur[k] = cur[k] ?? {};
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  async function uploadTo(path, file) {
    if (!file) return;
    setErr("");
    setMsg("");
    try {
      const { url } = await apiUploadImage(file);
      setField(path, url); // store same-origin /r2/<key> URL
      setMsg("Image uploaded ✅ (don’t forget to Save)");
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    }
  }

  function addDivision() {
    setDraft((prev) => {
      const next = deepClone(prev);
      const items = Array.isArray(next.divisions?.items) ? next.divisions.items : [];
      items.push({
        code: "",
        name: "",
        status: "tbd",
        imagePath: "",
        active: true,
        order: items.length + 1,
        leagues: ensure10Leagues({ leagues: [] }),
      });
      next.divisions = next.divisions || {};
      next.divisions.items = items;
      return next;
    });
  }

  function removeDivision(idx) {
    setDraft((prev) => {
      const next = deepClone(prev);
      next.divisions = next.divisions || {};
      next.divisions.items = (next.divisions.items || []).filter((_, i) => i !== idx);
      return next;
    });
  }

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">Mini-Leagues Admin</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                CMS <span className="text-primary">Editor</span>
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-prose">
                This saves to <span className="font-semibold text-fg">R2</span>, so it stays intact across future builds and deploys.
                You can edit page content and manage divisions/leagues (10 leagues per division).
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/mini-leagues" className="btn btn-outline">
                  View Public Page →
                </Link>
                <button type="button" onClick={onSave} disabled={saving || loading} className="btn btn-primary">
                  {saving ? "Saving…" : "Save to R2"}
                </button>
              </div>

              <div className="mt-4 inline-flex flex-wrap gap-2">
                <Pill>Season: {MINI_LEAGUES_SEASON}</Pill>
                <Pill>R2 key: cms/mini-leagues.json</Pill>
              </div>

              {loading ? <p className="text-xs text-muted">Loading…</p> : null}
              {msg ? <p className="text-xs text-emerald-200/90">{msg}</p> : null}
              {err ? <p className="text-xs text-amber-200/90">{err}</p> : null}
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`btn ${tab === t.key ? "btn-primary" : "btn-outline"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "content" ? (
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] items-start">
              <div className="space-y-6">
                {/* HERO */}
                <Card title="Hero">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Kicker" value={draft.hero?.kicker || ""} onChange={(v) => setField(["hero", "kicker"], v)} />
                    <Input label="Title" value={draft.hero?.title || ""} onChange={(v) => setField(["hero", "title"], v)} />
                  </div>

                  <Textarea label="Subhead" value={draft.hero?.subhead || ""} onChange={(v) => setField(["hero", "subhead"], v)} />

                  <div className="grid gap-4 sm:grid-cols-2 items-start">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">Hero image</p>
                      <div className="rounded-2xl border border-subtle bg-subtle-surface p-3 space-y-2">
                        <div className="relative h-36 w-full overflow-hidden rounded-xl border border-subtle">
                          <Image
                            src={draft.hero?.heroImagePath || "/photos/minileagues-hero.webp"}
                            alt="Hero"
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 40vw"
                          />
                        </div>
                        <input type="file" accept="image/*" onChange={(e) => uploadTo(["hero", "heroImagePath"], e.target.files?.[0])} />
                        <p className="text-xs text-muted">Uploads to R2 and stores the returned URL.</p>
                      </div>
                    </div>

                    <ListEditor
                      title="Hero chips"
                      items={Array.isArray(draft.hero?.chips) ? draft.hero.chips : []}
                      onChange={(items) => setField(["hero", "chips"], items)}
                      placeholder="Season ends after Week 14"
                    />
                  </div>
                </Card>

                {/* SETTINGS */}
                <Card title="Settings">
                  <Input label="Section title" value={draft.settings?.title || ""} onChange={(v) => setField(["settings", "title"], v)} />
                  <ListEditor
                    title="Bullets"
                    items={Array.isArray(draft.settings?.bullets) ? draft.settings.bullets : []}
                    onChange={(items) => setField(["settings", "bullets"], items)}
                    placeholder="Most points wins ⚠️"
                  />
                </Card>

                {/* HOW IT WORKS */}
                <Card title="How the Game Works">
                  <Input
                    label="Section title"
                    value={draft.howItWorks?.title || ""}
                    onChange={(v) => setField(["howItWorks", "title"], v)}
                  />

                  <ListEditor
                    title="Paragraphs"
                    multiline
                    items={Array.isArray(draft.howItWorks?.paragraphs) ? draft.howItWorks.paragraphs : []}
                    onChange={(items) => setField(["howItWorks", "paragraphs"], items)}
                    placeholder="You play and win inside your league…"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-3">
                      <Input
                        label="Without wager title"
                        value={draft.howItWorks?.withoutWager?.title || ""}
                        onChange={(v) => setField(["howItWorks", "withoutWager", "title"], v)}
                      />
                      <ListEditor
                        title="Without wager bullets"
                        items={Array.isArray(draft.howItWorks?.withoutWager?.bullets) ? draft.howItWorks.withoutWager.bullets : []}
                        onChange={(items) => setField(["howItWorks", "withoutWager", "bullets"], items)}
                        placeholder="Eligible for the Division Bonus (+$30)"
                      />
                    </div>

                    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-3">
                      <Input
                        label="With wager title"
                        value={draft.howItWorks?.withWager?.title || ""}
                        onChange={(v) => setField(["howItWorks", "withWager", "title"], v)}
                      />
                      <ListEditor
                        title="With wager bullets"
                        items={Array.isArray(draft.howItWorks?.withWager?.bullets) ? draft.howItWorks.withWager.bullets : []}
                        onChange={(items) => setField(["howItWorks", "withWager", "bullets"], items)}
                        placeholder="Eligible to win all wagers (big upside)"
                      />
                    </div>
                  </div>

                  <Input
                    label="Footer note"
                    value={draft.howItWorks?.footerNote || ""}
                    onChange={(v) => setField(["howItWorks", "footerNote"], v)}
                  />
                </Card>

                {/* CASH */}
                <Card title="Cash">
                  <Input label="Section title" value={draft.cash?.title || ""} onChange={(v) => setField(["cash", "title"], v)} />
                  <ListEditor
                    title="Bullets"
                    items={Array.isArray(draft.cash?.bullets) ? draft.cash.bullets : []}
                    onChange={(items) => setField(["cash", "bullets"], items)}
                    placeholder="$4 buy-in"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Payments title"
                      value={draft.cash?.paymentsTitle || ""}
                      onChange={(v) => setField(["cash", "paymentsTitle"], v)}
                    />
                    <Input
                      label="Payments text"
                      value={draft.cash?.paymentsText || ""}
                      onChange={(v) => setField(["cash", "paymentsText"], v)}
                    />
                  </div>
                </Card>

                {/* ETIQUETTE */}
                <Card title="Draft Etiquette">
                  <Input label="Section title" value={draft.etiquette?.title || ""} onChange={(v) => setField(["etiquette", "title"], v)} />
                  <ListEditor
                    title="Bullets"
                    items={Array.isArray(draft.etiquette?.bullets) ? draft.etiquette.bullets : []}
                    onChange={(items) => setField(["etiquette", "bullets"], items)}
                    placeholder="Please tag the next person up."
                  />
                </Card>

                {/* WINNERS */}
                <Card title="Winners">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Title" value={draft.winners?.title || ""} onChange={(v) => setField(["winners", "title"], v)} />
                    <Input label="Subtitle" value={draft.winners?.subtitle || ""} onChange={(v) => setField(["winners", "subtitle"], v)} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">Winners image</p>
                    <div className="rounded-2xl border border-subtle bg-subtle-surface p-3 space-y-2">
                      <div className="relative h-40 w-full overflow-hidden rounded-xl border border-subtle">
                        <Image
                          src={draft.winners?.winnersImagePath || "/photos/minileagues-winners.webp"}
                          alt="Winners"
                          fill
                          className="object-cover"
                          sizes="100vw"
                        />
                      </div>
                      <input type="file" accept="image/*" onChange={(e) => uploadTo(["winners", "winnersImagePath"], e.target.files?.[0])} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right: Preview */}
              <aside className="space-y-4 sticky top-4">
                <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-muted">Preview</p>
                      <p className="text-sm font-semibold">Public model</p>
                    </div>
                    <StatusPill status={model?.divisions?.items?.length ? "filling" : "tbd"} />
                  </div>
                  <div className="p-5 space-y-2 text-sm text-muted">
                    <p>
                      Divisions: <span className="font-semibold text-fg">{model?.divisions?.items?.length || 0}</span>
                    </p>
                    <p>
                      Hero image: <span className="font-mono text-xs">{model?.hero?.heroImagePath}</span>
                    </p>
                    <p>
                      Winners image: <span className="font-mono text-xs">{model?.winners?.winnersImagePath}</span>
                    </p>
                    <p className="text-xs text-muted">
                      This preview panel is just sanity checks — the public page renders the same JSON.
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          ) : (
            <section className="space-y-4">
              <Card title="Divisions">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">
                      Each division contains <span className="font-semibold text-fg">10 leagues</span>. Status options:{" "}
                      <span className="font-semibold text-fg">full / filling / tbd / drafting</span>.
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={addDivision}>
                    + Add Division
                  </button>
                </div>

                <div className="mt-5 space-y-6">
                  {(draft.divisions?.items || []).length ? (
                    (draft.divisions.items || []).map((div, dIdx) => (
                      <DivisionEditor
                        key={dIdx}
                        div={div}
                        dIdx={dIdx}
                        onChange={(nextDiv) =>
                          setDraft((prev) => {
                            const next = deepClone(prev);
                            next.divisions = next.divisions || {};
                            const items = Array.isArray(next.divisions.items) ? next.divisions.items : [];
                            items[dIdx] = {
                              ...nextDiv,
                              leagues: ensure10Leagues(nextDiv),
                            };
                            next.divisions.items = items;
                            return next;
                          })
                        }
                        onRemove={() => removeDivision(dIdx)}
                        onUploadDivisionImage={(file) => uploadTo(["divisions", "items", dIdx, "imagePath"], file)}
                        onUploadLeagueImage={(lIdx, file) => uploadTo(["divisions", "items", dIdx, "leagues", lIdx, "imagePath"], file)}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted">
                      No divisions yet. Add one, then fill in leagues.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 text-xs sm:text-sm backdrop-blur-sm">
      {children}
    </span>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-subtle bg-subtle-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-xl border border-subtle bg-subtle-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
      />
    </label>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status || "tbd").toLowerCase();
  const label = s === "full" ? "FULL" : s === "filling" ? "FILLING" : s === "drafting" ? "DRAFTING" : "TBD";
  const cls =
    s === "full"
      ? "bg-emerald-500/10 text-emerald-200 border-emerald-400/20"
      : s === "filling"
      ? "bg-amber-500/10 text-amber-200 border-amber-400/20"
      : s === "drafting"
      ? "bg-sky-500/10 text-sky-200 border-sky-400/20"
      : "bg-zinc-500/10 text-zinc-200 border-zinc-400/20";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${cls}`}>{label}</span>;
}

function ListEditor({ title, items, onChange, placeholder = "", multiline = false }) {
  const list = Array.isArray(items) ? items : [];

  function setItem(i, v) {
    const next = list.slice();
    next[i] = v;
    onChange(next);
  }

  function add() {
    onChange([...list, ""]);
  }

  function remove(i) {
    onChange(list.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{title}</p>
        <button type="button" onClick={add} className="btn btn-outline">
          + Add
        </button>
      </div>

      <div className="space-y-2">
        {list.length ? (
          list.map((it, i) => (
            <div key={i} className="flex items-start gap-2">
              {multiline ? (
                <textarea
                  value={it}
                  placeholder={placeholder}
                  onChange={(e) => setItem(i, e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-subtle bg-subtle-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
                />
              ) : (
                <input
                  value={it}
                  placeholder={placeholder}
                  onChange={(e) => setItem(i, e.target.value)}
                  className="w-full rounded-xl border border-subtle bg-subtle-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
                />
              )}
              <button type="button" onClick={() => remove(i)} className="btn btn-outline">
                ✕
              </button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-3 text-sm text-muted">No items yet.</div>
        )}
      </div>
    </div>
  );
}

function DivisionEditor({ div, dIdx, onChange, onRemove, onUploadDivisionImage, onUploadLeagueImage }) {
  const leagues = ensure10Leagues(div);

  function setDivField(key, val) {
    onChange({ ...div, [key]: val, leagues });
  }

  function setLeagueField(i, key, val) {
    const nextLeagues = leagues.slice();
    nextLeagues[i] = { ...nextLeagues[i], [key]: val };
    onChange({ ...div, leagues: nextLeagues });
  }

  return (
    <div className="rounded-3xl border border-subtle bg-subtle-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Division</p>
          <p className="text-sm font-semibold text-fg">{div.code || `#${dIdx + 1}`}</p>
        </div>

        <div className="flex gap-2">
          <StatusPill status={div.status} />
          <button type="button" className="btn btn-outline" onClick={onRemove}>
            Delete Division
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Division code (e.g. 100)" value={div.code || ""} onChange={(v) => setDivField("code", v)} />
        <Input label="Division name (optional)" value={div.name || ""} onChange={(v) => setDivField("name", v)} />
        <SelectStatus label="Division status" value={div.status || "tbd"} onChange={(v) => setDivField("status", v)} />
        <Input label="Order" value={String(div.order ?? "")} onChange={(v) => setDivField("order", Number(v) || 0)} type="number" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 items-start">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">Division image</p>
          <div className="rounded-2xl border border-subtle bg-card-surface p-3 space-y-2">
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-subtle">
              {div.imagePath ? (
                <Image src={div.imagePath} alt="Division" fill className="object-cover" sizes="100vw" />
              ) : (
                <div className="h-full w-full bg-subtle-surface" />
              )}
            </div>
            <input type="file" accept="image/*" onChange={(e) => onUploadDivisionImage(e.target.files?.[0])} />
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-card-surface p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">Notes</p>
          <p className="text-sm text-muted">
            Each division is forced to exactly <span className="font-semibold text-fg">10 leagues</span> so the public page layout stays stable.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">Leagues (10)</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l, i) => (
            <div key={i} className="rounded-2xl border border-subtle bg-card-surface p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-fg">{l.name || `League ${i + 1}`}</p>
                <StatusPill status={l.status} />
              </div>

              <Input label="League name" value={l.name || ""} onChange={(v) => setLeagueField(i, "name", v)} />
              <Input label="Sleeper URL" value={l.url || ""} onChange={(v) => setLeagueField(i, "url", v)} placeholder="https://sleeper.com/league/..." />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectStatus label="Status" value={l.status || "tbd"} onChange={(v) => setLeagueField(i, "status", v)} />
                <Input label="Order" value={String(l.order ?? i + 1)} onChange={(v) => setLeagueField(i, "order", Number(v) || i + 1)} type="number" />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">League image</p>
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-3 space-y-2">
                  <div className="relative h-24 w-full overflow-hidden rounded-xl border border-subtle">
                    {l.imagePath ? (
                      <Image src={l.imagePath} alt="League" fill className="object-cover" sizes="100vw" />
                    ) : (
                      <div className="h-full w-full bg-card-surface" />
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => onUploadLeagueImage(i, e.target.files?.[0])} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectStatus({ label, value, onChange }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-subtle bg-subtle-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
      >
        <option value="full">full</option>
        <option value="filling">filling</option>
        <option value="tbd">tbd</option>
        <option value="drafting">drafting</option>
      </select>
    </label>
  );
}
