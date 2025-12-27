// app/admin/mini-leagues/MiniLeaguesAdminClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const SEASON = CURRENT_SEASON;

const STATUS_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "filling", label: "FILLING" },
  { value: "drafting", label: "DRAFTING" },
  { value: "full", label: "FULL" },
];

// ==============================
// ONLY THESE ARE EDITABLE IN CMS
// ==============================
// NOTE: winners now has 2 images, each with its own caption.
// - caption1 = caption under image 1
// - caption2 = caption under image 2
const DEFAULT_PAGE_EDITABLE = {
  season: SEASON,
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/minileagues-v2.webp", // fallback if no key
    updatesHtml: "<p>Updates will show here.</p>",
  },
  winners: {
    title: "Last Year’s Winners",
    imageKey1: "",
    imageUrl1: "/photos/hall-of-fame/minileageus2024.png", // fallback
    caption1: "",
    imageKey2: "",
    imageUrl2: "",
    caption2: "",
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

// Upload only happens during Save.
// Payload fields drive deterministic keys on server, so overwrites stay clean.
async function uploadImage(file, payload) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);

  // required routing info (no UI option)
  form.append("section", payload.section);
  form.append("season", String(payload.season));

  if (payload.divisionCode) form.append("divisionCode", String(payload.divisionCode));
  if (payload.leagueOrder) form.append("leagueOrder", String(payload.leagueOrder));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(await readApiError(res));
  return res.json(); // expects { key: "..." }
}

// Delete one or more images from R2 (and any known extension variants).
// We only do this after a successful Save when something was actually removed.
async function deleteMedia({ keys = [], baseKeys = [] }) {
  const token = await getAccessToken();
  const res = await fetch("/api/admin/upload", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ keys, baseKeys }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

function keyToBase(key) {
  const k = String(key || "").trim().replace(/^\//, "");
  return k.replace(/\.[a-z0-9]{2,5}$/i, "");
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

function useObjectUrl() {
  const urlsRef = useRef(new Set());
  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current.clear();
    };
  }, []);
  return (file) => {
    if (!file) return "";
    const url = URL.createObjectURL(file);
    urlsRef.current.add(url);
    return url;
  };
}

export default function MiniLeaguesAdminClient() {
  const [tab, setTab] = useState("updates"); // "updates" | "divisions"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [divisions, setDivisions] = useState([]);
  // Snapshot of last-loaded (saved) divisions so we can compute deletions safely on Save.
  const [baselineDivisions, setBaselineDivisions] = useState([]);

  // Collapsible UI state
  const [openDivs, setOpenDivs] = useState(() => new Set()); // divisionCode set

  // ============================
  // PENDING FILES (NO AUTO UPLOAD)
  // ============================
  const makeUrl = useObjectUrl();

  const [pendingUpdatesFile, setPendingUpdatesFile] = useState(null);
  const [pendingWinners1File, setPendingWinners1File] = useState(null);
  const [pendingWinners2File, setPendingWinners2File] = useState(null);

  // key: `div:${divisionCode}` -> File
  const [pendingDivisionFiles, setPendingDivisionFiles] = useState(() => ({}));
  // key: `lg:${divisionCode}:${leagueOrder}` -> File
  const [pendingLeagueFiles, setPendingLeagueFiles] = useState(() => ({}));

  const divisionCount = divisions.length;
  const leagueCount = useMemo(() => {
    let n = 0;
    for (const d of divisions) n += Array.isArray(d.leagues) ? d.leagues.length : 0;
    return n;
  }, [divisions]);

  // ============================
  // PREVIEW SOURCES (prefer local pending file, else R2 key, else fallback URL)
  // ============================
  const updatesPreview =
    pendingUpdatesFile
      ? makeUrl(pendingUpdatesFile)
      : pageCfg?.hero?.promoImageKey
      ? `/r2/${pageCfg.hero.promoImageKey}`
      : pageCfg?.hero?.promoImageUrl;

  const winners1Preview =
    pendingWinners1File
      ? makeUrl(pendingWinners1File)
      : pageCfg?.winners?.imageKey1
      ? `/r2/${pageCfg.winners.imageKey1}`
      : pageCfg?.winners?.imageUrl1;

  const winners2Preview =
    pendingWinners2File
      ? makeUrl(pendingWinners2File)
      : pageCfg?.winners?.imageKey2
      ? `/r2/${pageCfg.winners.imageKey2}`
      : pageCfg?.winners?.imageUrl2;

  function divisionPreviewSrc(d) {
    const k = `div:${String(d.divisionCode)}`;
    const pending = pendingDivisionFiles[k];
    if (pending) return makeUrl(pending);
    return d.imageKey ? `/r2/${d.imageKey}` : d.imageUrl || "";
  }

  function leaguePreviewSrc(divisionCode, league) {
    const order = league?.order ?? 0;
    const k = `lg:${String(divisionCode)}:${String(order)}`;
    const pending = pendingLeagueFiles[k];
    if (pending) return makeUrl(pending);
    return league.imageKey ? `/r2/${league.imageKey}` : league.imageUrl || "";
  }

  // ==================================
  // LOAD
  // ==================================
  async function loadAll() {
    setErr("");
    setOk("");
    setLoading(true);

    // clear pending files when reloading so the UI matches actual saved state
    setPendingUpdatesFile(null);
    setPendingWinners1File(null);
    setPendingWinners2File(null);
    setPendingDivisionFiles({});
    setPendingLeagueFiles({});

    try {
      const page = await apiGET("page");
      const hero = page?.data?.hero || {};
      const winners = page?.data?.winners || {};

      // Back-compat:
      // - old schema might be winners.imageKey / imageUrl / caption
      const imageKey1 = winners.imageKey1 ?? winners.imageKey ?? "";
      const imageUrl1 = winners.imageUrl1 ?? winners.imageUrl ?? DEFAULT_PAGE_EDITABLE.winners.imageUrl1;
      const caption1 = winners.caption1 ?? winners.caption ?? "";

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
          imageKey1,
          imageUrl1,
          caption1,
          imageKey2: winners.imageKey2 ?? "",
          imageUrl2: winners.imageUrl2 ?? "",
          caption2: winners.caption2 ?? "",
        },
      });

      const div = await apiGET("divisions");
      const raw = div?.data;
      const list = Array.isArray(raw?.divisions) ? raw.divisions : Array.isArray(raw) ? raw : [];
      const next = list.length ? list : [emptyDivision("100"), emptyDivision("200"), emptyDivision("400")];
      setDivisions(next);
      setBaselineDivisions(next);

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

  // ==================================
  // MUTATORS
  // ==================================
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
      return [...prev, emptyDivision(nextCode)];
    });

    setOpenDivs((prev) => {
      const next = new Set(prev);
      next.add(String((divisions.length + 1) * 100));
      return next;
    });
  }

  function removeDivision(divIdx) {
    const code = String(divisions[divIdx]?.divisionCode || "");
    setDivisions((prev) => prev.filter((_, i) => i !== divIdx));
    if (code) {
      setOpenDivs((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  }

  function removeLeague(divIdx, leagueIdx) {
    setDivisions((prev) =>
      prev.map((d, i) => {
        if (i !== divIdx) return d;
        const leagues = Array.isArray(d.leagues) ? d.leagues.slice() : [];
        leagues.splice(leagueIdx, 1);
        return { ...d, leagues };
      })
    );
  }

  const canAct = !saving && !loading;

  // ==================================
  // SAVE HELPERS (UPLOAD THEN PUT)
  // ==================================
  async function saveUpdatesAndWinners() {
    setSaving(true);
    setErr("");
    setOk("");

    try {
      // 1) upload pending files (deterministic keys -> overwrites)
      let nextHeroKey = pageCfg.hero.promoImageKey;
      let nextW1Key = pageCfg.winners.imageKey1;
      let nextW2Key = pageCfg.winners.imageKey2;

      if (pendingUpdatesFile) {
        const up = await uploadImage(pendingUpdatesFile, {
          section: "mini-leagues-updates",
          season: SEASON,
        });
        nextHeroKey = up.key;
      }

      if (pendingWinners1File) {
        const up = await uploadImage(pendingWinners1File, {
          section: "mini-leagues-winners-1",
          season: SEASON,
        });
        nextW1Key = up.key;
      }

      if (pendingWinners2File) {
        const up = await uploadImage(pendingWinners2File, {
          section: "mini-leagues-winners-2",
          season: SEASON,
        });
        nextW2Key = up.key;
      }

      // 2) persist JSON (always the same fields)
      const payload = {
        season: SEASON,
        hero: {
          promoImageKey: nextHeroKey || "",
          promoImageUrl: pageCfg.hero.promoImageUrl || "",
          updatesHtml: pageCfg.hero.updatesHtml || "",
        },
        winners: {
          title: pageCfg.winners.title || "",
          imageKey1: nextW1Key || "",
          imageUrl1: pageCfg.winners.imageUrl1 || "",
          caption1: pageCfg.winners.caption1 || "",
          imageKey2: nextW2Key || "",
          imageUrl2: pageCfg.winners.imageUrl2 || "",
          caption2: pageCfg.winners.caption2 || "",
        },
      };

      await apiPUT("page", payload);

      // 3) update state + clear pending
      setPageCfg((p) => ({
        ...p,
        hero: { ...p.hero, promoImageKey: nextHeroKey || "" },
        winners: {
          ...p.winners,
          imageKey1: nextW1Key || "",
          imageKey2: nextW2Key || "",
        },
      }));

      setPendingUpdatesFile(null);
      setPendingWinners1File(null);
      setPendingWinners2File(null);

      setOk("Saved Updates + Winners (images uploaded on save).");
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
      // Upload pending division images first
      let nextDivisions = divisions;

      // 1) Divisions
      const divEntries = Object.entries(pendingDivisionFiles);
      for (const [key, file] of divEntries) {
        if (!file) continue;
        // key: div:CODE
        const divisionCode = key.split(":")[1];
        const up = await uploadImage(file, {
          section: "mini-leagues-division",
          season: SEASON,
          divisionCode,
        });

        nextDivisions = nextDivisions.map((d) =>
          String(d.divisionCode) === String(divisionCode) ? { ...d, imageKey: up.key } : d
        );
      }

      // 2) Leagues
      const leagueEntries = Object.entries(pendingLeagueFiles);
      for (const [key, file] of leagueEntries) {
        if (!file) continue;
        // key: lg:DIV:ORDER
        const [, divisionCode, leagueOrder] = key.split(":");
        const up = await uploadImage(file, {
          section: "mini-leagues-league",
          season: SEASON,
          divisionCode,
          leagueOrder,
        });

        nextDivisions = nextDivisions.map((d) => {
          if (String(d.divisionCode) !== String(divisionCode)) return d;
          const leagues = Array.isArray(d.leagues) ? d.leagues.map((l) => ({ ...l })) : [];
          const lo = Number(leagueOrder);
          for (let i = 0; i < leagues.length; i++) {
            const curOrder = Number(leagues[i].order ?? i + 1);
            if (curOrder === lo) {
              leagues[i].imageKey = up.key;
              break;
            }
          }
          return { ...d, leagues };
        });
      }

      // Compute what was removed compared to the last-loaded saved state.
      // We only delete media after a successful Save so the CMS can't get into
      // a state where content is deleted but JSON didn't update.
      const deletedKeys = new Set();
      const deletedBaseKeys = new Set();

      const addDelete = (k) => {
        const key = String(k || "").trim().replace(/^\//, "");
        if (!key) return;
        deletedKeys.add(key);
        deletedBaseKeys.add(keyToBase(key));
      };

      const nextByCode = new Map(nextDivisions.map((d) => [String(d.divisionCode), d]));
      for (const oldDiv of baselineDivisions) {
        const code = String(oldDiv?.divisionCode);
        const nextDiv = nextByCode.get(code);

        // Whole division removed -> delete division image + all league images within it
        if (!nextDiv) {
          addDelete(oldDiv?.imageKey);
          const olds = Array.isArray(oldDiv?.leagues) ? oldDiv.leagues : [];
          for (const l of olds) addDelete(l?.imageKey);
          continue;
        }

        // Division still exists -> delete only leagues removed (by order)
        const nextOrders = new Set(
          (Array.isArray(nextDiv?.leagues) ? nextDiv.leagues : [])
            .map((l, idx) => Number(l?.order ?? idx + 1))
            .filter((n) => Number.isFinite(n))
        );
        for (const l of Array.isArray(oldDiv?.leagues) ? oldDiv.leagues : []) {
          const ord = Number(l?.order);
          if (Number.isFinite(ord) && !nextOrders.has(ord)) {
            addDelete(l?.imageKey);
          }
        }
      }

      // Persist JSON
      await apiPUT("divisions", { season: SEASON, divisions: nextDivisions });

      // Delete any media for removed items (best-effort; do not fail the Save)
      if (deletedKeys.size || deletedBaseKeys.size) {
        try {
          await deleteMedia({
            keys: [...deletedKeys],
            baseKeys: [...deletedBaseKeys],
          });
        } catch {
          // Ignore — the JSON is already saved, worst case we leave some orphaned objects in R2.
        }
      }

      // Update state + clear pending maps
      setDivisions(nextDivisions);
      setBaselineDivisions(nextDivisions);
      setPendingDivisionFiles({});
      setPendingLeagueFiles({});
      setOk("Saved divisions (images uploaded on save). Deleted images for removed divisions/leagues.");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

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
                  Images do <strong>not</strong> upload on select. They upload only when you click <strong>Save</strong>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                
                <Link prefetch={false} href="/admin" className="btn btn-primary text-sm">
                    Admin Home
                </Link>
                <Link prefetch={false} className="btn btn-primary" href="/mini-leagues">
                  View Page
                </Link>
                <button className="btn btn-primary" type="button" onClick={loadAll} disabled={!canAct}>
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
              <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-red-300">{err}</div>
            ) : null}
            {ok ? (
              <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-green-300">{ok}</div>
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
                  <div className="text-sm text-muted">
                    Updates image{" "}
                    {pendingUpdatesFile ? <span className="text-amber-200">(pending)</span> : null}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setPendingUpdatesFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                  <Image src={updatesPreview} alt="Updates preview" fill className="object-cover" />
                </div>

                <button
                  className="btn btn-primary w-full"
                  type="button"
                  onClick={saveUpdatesAndWinners}
                  disabled={!canAct}
                >
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
                  onChange={(e) =>
                    setPageCfg((p) => ({ ...p, winners: { ...p.winners, title: e.target.value } }))
                  }
                />

                {/* Image 1 */}
                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted">
                      Winners image (1) {pendingWinners1File ? <span className="text-amber-200">(pending)</span> : null}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setPendingWinners1File(f);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <label className="block text-sm text-muted">Caption (1) (optional)</label>
                  <input
                    className="input w-full"
                    value={pageCfg.winners.caption1}
                    onChange={(e) =>
                      setPageCfg((p) => ({ ...p, winners: { ...p.winners, caption1: e.target.value } }))
                    }
                  />

                  <div className="rounded-2xl border border-subtle bg-black/20 overflow-hidden p-4">
                    <div className="relative w-full max-w-[720px] mx-auto h-[280px] sm:h-[320px]">
                      <Image src={winners1Preview} alt="Winners preview (1)" fill className="object-contain" />
                    </div>
                  </div>
                </div>

                {/* Image 2 */}
                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted">
                      Winners image (2) {pendingWinners2File ? <span className="text-amber-200">(pending)</span> : null}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setPendingWinners2File(f);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <label className="block text-sm text-muted">Caption (2) (optional)</label>
                  <input
                    className="input w-full"
                    value={pageCfg.winners.caption2}
                    onChange={(e) =>
                      setPageCfg((p) => ({ ...p, winners: { ...p.winners, caption2: e.target.value } }))
                    }
                  />

                  {winners2Preview ? (
                    <div className="rounded-2xl border border-subtle bg-black/20 overflow-hidden p-4">
                      <div className="relative w-full max-w-[720px] mx-auto h-[280px] sm:h-[320px]">
                        <Image src={winners2Preview} alt="Winners preview (2)" fill className="object-contain" />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-subtle bg-black/10 p-4 text-sm text-muted">
                      (No image selected for slot 2 yet)
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-outline w-full"
                  type="button"
                  onClick={saveUpdatesAndWinners}
                  disabled={!canAct}
                >
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
                    <p className="text-xs text-muted">
                      Images are <strong>pending</strong> until you click <strong>Save Divisions</strong>.
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
                    const divPreview = divisionPreviewSrc(d);
                    const divPending = Boolean(pendingDivisionFiles[`div:${String(d.divisionCode)}`]);

                    return (
                      <div
                        key={d.divisionCode}
                        className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden"
                      >
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
                                {divPending ? (
                                  <span className="text-xs text-amber-200">(image pending)</span>
                                ) : null}
                                <span className="text-xs text-muted">Order: {d.order ?? "—"}</span>
                              </div>
                              <p className="text-xs text-muted">
                                {Array.isArray(d.leagues) ? d.leagues.filter((x) => x.active !== false).length : 0} active
                                leagues
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
                                    Division Image{" "}
                                    {divPending ? <span className="text-amber-200">(pending)</span> : null}
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const key = `div:${String(d.divisionCode)}`;
                                      setPendingDivisionFiles((prev) => ({ ...prev, [key]: f }));
                                      e.target.value = "";
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs text-muted">
                                Deleting a division also deletes all leagues inside it (and their images) when you click <strong>Save Divisions</strong>.
                              </div>
                              <button
                                type="button"
                                className="btn btn-outline border-red-500/30 text-red-200 hover:bg-red-500/10"
                                disabled={!canAct}
                                onClick={() => {
                                  const name = d.title || `Division ${d.divisionCode}`;
                                  if (!confirm(`Delete ${name} and all its leagues? This is saved only after you click Save Divisions.`)) return;

                                  // Clear any pending files for this division + its leagues
                                  setPendingDivisionFiles((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`div:${String(d.divisionCode)}`];
                                    return copy;
                                  });
                                  setPendingLeagueFiles((prev) => {
                                    const copy = { ...prev };
                                    const leagues = Array.isArray(d.leagues) ? d.leagues : [];
                                    for (const l of leagues) {
                                      const ord = Number(l.order);
                                      if (Number.isFinite(ord)) delete copy[`lg:${String(d.divisionCode)}:${String(ord)}`];
                                    }
                                    return copy;
                                  });

                                  removeDivision(divIdx);
                                }}
                              >
                                Delete Division
                              </button>
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
                                  const order = Number(l.order ?? leagueIdx + 1);
                                  const pendingKey = `lg:${String(d.divisionCode)}:${String(order)}`;
                                  const leaguePending = Boolean(pendingLeagueFiles[pendingKey]);
                                  const leaguePreview = leaguePreviewSrc(d.divisionCode, { ...l, order });

                                  return (
                                    <div
                                      key={`${d.divisionCode}-${leagueIdx}`}
                                      className="rounded-2xl border border-subtle bg-card-surface p-4"
                                    >
                                      <div className="grid gap-3 md:grid-cols-[1.2fr_1.8fr_.7fr_.5fr_auto_auto] items-end">
                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            Name
                                          </label>
                                          <input
                                            className="input w-full"
                                            value={l.name || ""}
                                            onChange={(e) =>
                                              updateLeague(divIdx, leagueIdx, { name: e.target.value })
                                            }
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            URL
                                          </label>
                                          <input
                                            className="input w-full"
                                            value={l.url || ""}
                                            onChange={(e) =>
                                              updateLeague(divIdx, leagueIdx, { url: e.target.value })
                                            }
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                            Status
                                          </label>
                                          <select
                                            className="input w-full"
                                            value={l.status || "tbd"}
                                            onChange={(e) =>
                                              updateLeague(divIdx, leagueIdx, { status: e.target.value })
                                            }
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
                                            value={order}
                                            onChange={(e) => {
                                              const nextOrder = Number(e.target.value || 0);

                                              // move any pending file key with it so it stays aligned to the league
                                              const oldKey = `lg:${String(d.divisionCode)}:${String(order)}`;
                                              const newKey = `lg:${String(d.divisionCode)}:${String(nextOrder)}`;
                                              setPendingLeagueFiles((prev) => {
                                                if (!prev[oldKey]) return prev;
                                                const copy = { ...prev };
                                                copy[newKey] = copy[oldKey];
                                                delete copy[oldKey];
                                                return copy;
                                              });

                                              updateLeague(divIdx, leagueIdx, { order: nextOrder });
                                            }}
                                          />
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                              Image{" "}
                                              {leaguePending ? <span className="text-amber-200">(pending)</span> : null}
                                            </div>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (!f) return;
                                                setPendingLeagueFiles((prev) => ({ ...prev, [pendingKey]: f }));
                                                e.target.value = "";
                                              }}
                                            />
                                          </div>

                                          {leaguePreview ? (
                                            <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-subtle bg-black/20 shrink-0">
                                              <Image src={leaguePreview} alt="League preview" fill className="object-cover" />
                                            </div>
                                          ) : null}
                                        </div>

                                        <div className="flex items-end justify-end">
                                          <button
                                            type="button"
                                            className="btn btn-outline border-red-500/30 text-red-200 hover:bg-red-500/10"
                                            disabled={!canAct}
                                            onClick={() => {
                                              const name = l.name || `League ${order}`;
                                              if (!confirm(`Delete ${name}? This is saved only after you click Save Divisions.`)) return;

                                              // Clear any pending upload for this league slot
                                              setPendingLeagueFiles((prev) => {
                                                if (!prev[pendingKey]) return prev;
                                                const copy = { ...prev };
                                                delete copy[pendingKey];
                                                return copy;
                                              });

                                              removeLeague(divIdx, leagueIdx);
                                            }}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>

                                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
                                        <input
                                          type="checkbox"
                                          checked={l.active !== false}
                                          onChange={(e) =>
                                            updateLeague(divIdx, leagueIdx, { active: e.target.checked })
                                          }
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
