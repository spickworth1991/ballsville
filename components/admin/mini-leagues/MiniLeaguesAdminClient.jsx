"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;

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
  season: DEFAULT_SEASON,
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
      // Sleeper-backed (optional)
      leagueId: "",
      sleeperUrl: "",
      avatarId: "",

      name: `League ${i + 1}`,
      url: "",
      status: "tbd",
      notReady: false,
      active: true,
      order: i + 1,
      imageKey: "",
      imageUrl: "",

      // Sleeper-derived fill counts (persisted)
      totalTeams: 0,
      filledTeams: 0,
      openTeams: 0,
    })),
  };
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "predraft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason" || s === "in-season") return "inseason";
  if (s === "complete") return "complete";
  return s || "predraft";
}

// Mini-leagues public-facing statuses are: tbd|filling|drafting|full
// We derive them from Sleeper status + open slots so the public page can stay simple.
function miniStatusFromSleeper({ sleeperStatus, openTeams, notReady }) {
  if (notReady) return "tbd";
  const s = String(sleeperStatus || "").toLowerCase().trim();
  if (s === "drafting") return "drafting";
  if (Number(openTeams) <= 0) return "full";
  return "filling";
}

async function sleeperLeagueInfo(leagueId) {
  const id = String(leagueId || "").trim();
  if (!id) throw new Error("Missing league id.");
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper league request failed (${res.status})`);
  return res.json();
}

async function sleeperLeagueRosters(leagueId) {
  const id = String(leagueId || "").trim();
  if (!id) throw new Error("Missing league id.");
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}/rosters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper rosters request failed (${res.status})`);
  return res.json();
}

function computeFillCounts(league, rosters) {
  const totalTeams = Number(league?.total_rosters) || (Array.isArray(rosters) ? rosters.length : 0);
  const filledTeams = Array.isArray(rosters) ? rosters.filter((r) => r && r.owner_id).length : 0;
  const openTeams = Math.max(0, totalTeams - filledTeams);
  return { totalTeams, filledTeams, openTeams };
}

async function fetchAvatarFile(avatarId) {
  const a = String(avatarId || "").trim();
  if (!a) return null;
  const url = `https://sleepercdn.com/avatars/${encodeURIComponent(a)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], `${a}.png`, { type });
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

async function apiGET(type, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${encodeURIComponent(season)}&type=${type}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUT(type, data, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${encodeURIComponent(season)}`, {
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
async function uploadImage(file, payload) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);

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
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [seasonDraft, setSeasonDraft] = useState(String(DEFAULT_SEASON));

  const [tab, setTab] = useState("updates"); // "updates" | "divisions"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [divisions, setDivisions] = useState([]);
  const [baselineDivisions, setBaselineDivisions] = useState([]);
  const [baselineSeason, setBaselineSeason] = useState(null);

  const [openDivs, setOpenDivs] = useState(() => new Set());

  // per-division rollover target year drafts (Big Game style)
  const [rollYearByDiv, setRollYearByDiv] = useState(() => ({}));

  // ============================
  // PENDING FILES (NO AUTO UPLOAD)
  // ============================
  const makeUrl = useObjectUrl();

  const [pendingUpdatesFile, setPendingUpdatesFile] = useState(null);
  const [pendingWinners1File, setPendingWinners1File] = useState(null);
  const [pendingWinners2File, setPendingWinners2File] = useState(null);

  const [pendingDivisionFiles, setPendingDivisionFiles] = useState(() => ({}));
  const [pendingLeagueFiles, setPendingLeagueFiles] = useState(() => ({}));

  const divisionCount = divisions.length;
  const leagueCount = useMemo(() => {
    let n = 0;
    for (const d of divisions) n += Array.isArray(d.leagues) ? d.leagues.length : 0;
    return n;
  }, [divisions]);

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
  async function loadAll(seasonArg = season) {
    setErr("");
    setOk("");
    setLoading(true);

    setPendingUpdatesFile(null);
    setPendingWinners1File(null);
    setPendingWinners2File(null);
    setPendingDivisionFiles({});
    setPendingLeagueFiles({});

    try {
      const nextSeason = Number(seasonArg) || DEFAULT_SEASON;
      setSeason(nextSeason);
      setSeasonDraft(String(nextSeason));

      const page = await apiGET("page", nextSeason);
      const hero = page?.data?.hero || {};
      const winners = page?.data?.winners || {};

      const imageKey1 = winners.imageKey1 ?? winners.imageKey ?? "";
      const imageUrl1 = winners.imageUrl1 ?? winners.imageUrl ?? DEFAULT_PAGE_EDITABLE.winners.imageUrl1;
      const caption1 = winners.caption1 ?? winners.caption ?? "";

      setPageCfg({
        ...DEFAULT_PAGE_EDITABLE,
        season: nextSeason,
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

      const div = await apiGET("divisions", nextSeason);
      const raw = div?.data;
      const list = Array.isArray(raw?.divisions) ? raw.divisions : Array.isArray(raw) ? raw : [];
      const next = list.length ? list : [emptyDivision("100"), emptyDivision("200"), emptyDivision("400")];
      setDivisions(next);
      setBaselineDivisions(next);
      setBaselineSeason(nextSeason);

      setOpenDivs((prev) => {
        if (prev.size) return prev;
        const s = new Set();
        const first = (list.length ? list : [emptyDivision("100")])[0];
        if (first?.divisionCode) s.add(String(first.divisionCode));
        return s;
      });

      // seed per-division rollover drafts (default = next season)
      setRollYearByDiv((prev) => {
        const nextMap = { ...prev };
        for (const d of next) {
          const code = String(d?.divisionCode || "");
          if (!code) continue;
          if (nextMap[code] == null) nextMap[code] = String(nextSeason + 1);
        }
        return nextMap;
      });
    } catch (e) {
      setErr(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(DEFAULT_SEASON);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function addDivision() {
    const nextCode = String(divisionCount ? Math.max(...divisions.map((d) => Number(d.divisionCode) || 0)) + 100 : 100);
    const d = emptyDivision(nextCode);
    setDivisions((prev) => [...prev, d]);
    setOpenDivs((prev) => {
      const next = new Set(prev);
      next.add(String(d.divisionCode));
      return next;
    });
    setRollYearByDiv((prev) => ({ ...prev, [String(d.divisionCode)]: String(season + 1) }));
  }

  // ✅ KEEPING your delete helpers exactly
  function removeDivision(divIdx) {
    const code = divisions?.[divIdx]?.divisionCode;
    if (!code) return;
    if (!window.confirm(`Delete Division ${code}?`)) return;

    setPendingDivisionFiles((prev) => {
      const next = { ...prev };
      delete next[`div:${String(code)}`];
      return next;
    });
    setPendingLeagueFiles((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(`lg:${String(code)}:`)) delete next[k];
      }
      return next;
    });

    setDivisions((prev) => prev.filter((_, i) => i !== divIdx));
    setOpenDivs((prev) => {
      const next = new Set(prev);
      next.delete(String(code));
      return next;
    });

    setRollYearByDiv((prev) => {
      const next = { ...prev };
      delete next[String(code)];
      return next;
    });
  }

  function addLeague(divIdx) {
    setDivisions((prev) =>
      prev.map((d, i) => {
        if (i !== divIdx) return d;
        const leagues = Array.isArray(d.leagues) ? d.leagues.slice() : [];
        const nextOrder = leagues.length ? Math.max(...leagues.map((l) => Number(l.order) || 0)) + 1 : 1;
        leagues.push({
          name: `League ${nextOrder}`,
          url: "",
          status: "tbd",
          active: true,
          order: nextOrder,
          imageKey: "",
          imageUrl: "",
        });
        return { ...d, leagues };
      })
    );
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
  // ✅ PER-DIVISION ROLLOVER (Big Game style)
  // ==================================
  async function rolloverDivision(divIdx, targetRaw) {
    const target = Number(targetRaw);
    if (!Number.isFinite(target)) return;
    if (Number(target) === Number(season)) return;

    const srcDiv = divisions?.[divIdx];
    const srcCode = safeStr(srcDiv?.divisionCode).trim();
    if (!srcDiv || !srcCode) return;

    const okConfirm = window.confirm(
      `Rollover "${safeStr(srcDiv.title) || `Division ${srcCode}`}" from ${season} → ${target}?\n\nThis will CLEAR Sleeper URLs for that division.\n\nAfter this, you’ll be viewing season ${target}. Click "Save Divisions" to publish.`
    );
    if (!okConfirm) return;

    setErr("");
    setOk("");
    setSaving(true);

    try {
      // 1) Load target season divisions (or seed defaults)
      let targetDivs = [];
      try {
        const div = await apiGET("divisions", target);
        const raw = div?.data;
        const list = Array.isArray(raw?.divisions) ? raw.divisions : Array.isArray(raw) ? raw : [];
        targetDivs = list;
      } catch {
        // If target JSON doesn't exist yet, we can still create it on save.
        targetDivs = [];
      }

      // 2) Remove from current season list
      const remaining = divisions.filter((_, i) => i !== divIdx);

      // 3) Prepare moved division (clear URLs)
      const moved = {
        ...srcDiv,
        leagues: Array.isArray(srcDiv.leagues) ? srcDiv.leagues.map((l) => ({ ...l, url: "" })) : [],
      };

      // If target already has a division with same code, replace it; else append
      const existingIdx = targetDivs.findIndex((d) => String(d?.divisionCode) === String(srcCode));
      let nextTargetDivs;
      if (existingIdx >= 0) {
        nextTargetDivs = targetDivs.map((d, i) => (i === existingIdx ? moved : d));
      } else {
        nextTargetDivs = [...targetDivs, moved];
      }

      // 4) Switch editor to target season
      setSeason(target);
      setSeasonDraft(String(target));

      // pageCfg is season-scoped, keep consistent
      setPageCfg((p) => ({ ...p, season: target }));

      setDivisions(nextTargetDivs);

      // 5) Prevent cross-season deletes on first save in target
      setBaselineDivisions(nextTargetDivs);
      setBaselineSeason(null);

      // 6) Keep UI sane
      setOpenDivs((prev) => {
        const next = new Set(prev);
        next.add(String(srcCode));
        return next;
      });

      setRollYearByDiv((prev) => ({ ...prev, [String(srcCode)]: String(target + 1) }));

      // clear pending files (they were for the prior season)
      setPendingUpdatesFile(null);
      setPendingWinners1File(null);
      setPendingWinners2File(null);
      setPendingDivisionFiles({});
      setPendingLeagueFiles({});

      setOk(`Rolled "${safeStr(srcDiv.title) || `Division ${srcCode}`}" to season ${target} (Sleeper URLs cleared). Click "Save Divisions" to publish.`);
      setErr("");

      // NOTE: we do NOT auto-save. Same pattern as Big Game: rollover then Save.
      // Also: we do not automatically delete anything from the source season file — you can load that season and save if you want it removed.
      // If you want it automatically removed from the source season JSON too, we can add that as a second write.
      // For now: minimal, safe, matches the "roll then save" behavior.
      // (Because auto-writing 2 seasons is riskier.)
      // If you want the 2-write behavior, tell me and I’ll add it cleanly.
      // (No other changes.)
    } catch (e) {
      setErr(e?.message || "Rollover failed.");
    } finally {
      setSaving(false);
    }
  }

  // ==================================
  // SAVE HELPERS (UPLOAD THEN PUT)
  // ==================================
  async function saveUpdatesAndWinners() {
    setSaving(true);
    setErr("");
    setOk("");

    try {
      let nextHeroKey = pageCfg.hero.promoImageKey;
      let nextW1Key = pageCfg.winners.imageKey1;
      let nextW2Key = pageCfg.winners.imageKey2;

      if (pendingUpdatesFile) {
        const up = await uploadImage(pendingUpdatesFile, {
          section: "mini-leagues-updates",
          season,
        });
        nextHeroKey = up.key;
      }

      if (pendingWinners1File) {
        const up = await uploadImage(pendingWinners1File, {
          section: "mini-leagues-winners-1",
          season,
        });
        nextW1Key = up.key;
      }

      if (pendingWinners2File) {
        const up = await uploadImage(pendingWinners2File, {
          section: "mini-leagues-winners-2",
          season,
        });
        nextW2Key = up.key;
      }

      const payload = {
        season,
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

      await apiPUT("page", payload, season);

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
      let nextDivisions = divisions;

      // 1) Divisions
      const divEntries = Object.entries(pendingDivisionFiles);
      for (const [key, file] of divEntries) {
        if (!file) continue;
        const divisionCode = key.split(":")[1];
        const up = await uploadImage(file, {
          section: "mini-leagues-division",
          season,
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
        const [, divisionCode, leagueOrder] = key.split(":");
        const up = await uploadImage(file, {
          section: "mini-leagues-league",
          season,
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

      const deletedKeys = new Set();
      const deletedBaseKeys = new Set();

      const addDelete = (k) => {
        const key = String(k || "").trim().replace(/^\//, "");
        if (!key) return;
        deletedKeys.add(key);
        deletedBaseKeys.add(keyToBase(key));
      };

      if (baselineSeason === Number(season)) {
        const nextByCode = new Map(nextDivisions.map((d) => [String(d.divisionCode), d]));
        for (const oldDiv of baselineDivisions) {
          const code = String(oldDiv?.divisionCode);
          const nextDiv = nextByCode.get(code);

          if (!nextDiv) {
            addDelete(oldDiv?.imageKey);
            const olds = Array.isArray(oldDiv?.leagues) ? oldDiv.leagues : [];
            for (const l of olds) addDelete(l?.imageKey);
            continue;
          }

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
      }


      // Enforce automatic status behavior:
      // - If notReady=true → status is always "tbd"
      // - Otherwise keep whatever last synced status is (default "tbd")
      nextDivisions = (Array.isArray(nextDivisions) ? nextDivisions : []).map((d) => {
        const leagues = Array.isArray(d?.leagues)
          ? d.leagues.map((l) => ({
              ...l,
              status: l?.notReady ? "tbd" : (l?.status || "tbd"),
            }))
          : [];
        return { ...d, leagues };
      });

      await apiPUT("divisions", { season, divisions: nextDivisions }, season);

      if ((deletedKeys.size || deletedBaseKeys.size) && baselineSeason === Number(season)) {
        try {
          await deleteMedia({
            keys: [...deletedKeys],
            baseKeys: [...deletedBaseKeys],
          });
        } catch {
          // ignore
        }
      }

      setDivisions(nextDivisions);
      setBaselineDivisions(nextDivisions);
      setBaselineSeason(Number(season));
      setPendingDivisionFiles({});
      setPendingLeagueFiles({});
      setOk(
        baselineSeason === Number(season)
          ? "Saved divisions (images uploaded on save). Deleted images for removed divisions/leagues."
          : "Saved divisions (images uploaded on save)."
      );
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshStatusesAndCounts() {
    setErr("");
    setOk("");
    setRefreshing(true);
    try {
      const nextDivisions = divisions.map((d) => ({
        ...d,
        leagues: Array.isArray(d?.leagues) ? d.leagues.map((l) => ({ ...l })) : [],
      }));

      for (const d of nextDivisions) {
        const divCode = String(d?.divisionCode || "").trim();
        for (const l of d.leagues) {
          const leagueId = String(l?.leagueId || "").trim();
          if (!leagueId) continue;

          const [info, rosters] = await Promise.all([
            sleeperLeagueInfo(leagueId),
            sleeperLeagueRosters(leagueId),
          ]);

          const { totalTeams, filledTeams, openTeams } = computeFillCounts(info, rosters);
          const sleeperStatus = normalizeSleeperStatus(info?.status);
          const nextStatus = miniStatusFromSleeper({ sleeperStatus, openTeams, notReady: Boolean(l?.notReady) });

          const nextAvatarId = String(info?.avatar || "").trim();
          const prevAvatarId = String(l?.avatarId || "").trim();

          // Always update counts (persisted)
          l.totalTeams = totalTeams;
          l.filledTeams = filledTeams;
          l.openTeams = openTeams;
          l.sleeperUrl = `https://sleeper.com/leagues/${leagueId}`;

          // Only overwrite status/name when not forced TBD.
          if (!l.notReady) {
            if (info?.name) l.name = info.name;
            l.status = ["tbd", "filling", "drafting", "full"].includes(nextStatus) ? nextStatus : l.status;
          }

          l.avatarId = nextAvatarId;

          // Avatar upload if changed or missing.
          const shouldUpload = Boolean(nextAvatarId) && (nextAvatarId !== prevAvatarId || !String(l.imageKey || "").trim());
          if (shouldUpload) {
            const file = await fetchAvatarFile(nextAvatarId);
            if (file) {
              const up = await uploadImage(file, {
                section: "mini-leagues-league",
                season,
                divisionCode: divCode,
                leagueOrder: l.order,
              });
              if (up?.key) l.imageKey = up.key;
            }
          }
        }
      }

      await apiPUT("divisions", { season, divisions: nextDivisions }, season);
      setDivisions(nextDivisions);
      setBaselineDivisions(nextDivisions);
      setOk("Statuses + player counts refreshed from Sleeper and saved to R2.");
    } catch (e) {
      setErr(e?.message || "Failed to refresh from Sleeper.");
    } finally {
      setRefreshing(false);
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
                <div className="flex items-center gap-2 rounded-2xl border border-subtle bg-black/20 px-3 py-2">
                  <span className="text-xs text-muted">Season</span>
                  <input
                    className="input h-9 w-[96px] text-sm"
                    type="number"
                    value={seasonDraft}
                    onChange={(e) => setSeasonDraft(e.target.value)}
                  />
                  <button className="btn btn-outline text-sm" type="button" onClick={() => loadAll(seasonDraft)} disabled={!canAct}>
                    Load
                  </button>
                </div>

                <Link prefetch={false} href="/admin" className="btn btn-primary text-sm">
                  Admin Home
                </Link>
                <Link prefetch={false} className="btn btn-primary" href="/mini-leagues">
                  View Page
                </Link>

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
                  onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))}
                />

                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-muted">
                    Updates image {pendingUpdatesFile ? <span className="text-amber-200">(pending)</span> : null}
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

                <button className="btn btn-primary w-full" type="button" onClick={saveUpdatesAndWinners} disabled={!canAct}>
                  {saving ? "Saving…" : "Save Updates + Winners"}
                </button>
              </div>

              {/* WINNERS */}
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Winners</h2>
                    <p className="text-sm text-muted">Two images supported (each with its own caption).</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-muted">Section title</label>
                  <input
                    className="input w-full"
                    value={pageCfg.winners.title}
                    onChange={(e) => setPageCfg((p) => ({ ...p, winners: { ...p.winners, title: e.target.value } }))}
                  />
                </div>

                {/* Winner #1 */}
                <div className="rounded-2xl border border-subtle bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Winners image #1</p>
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

                  <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                    <Image src={winners1Preview} alt="Winners #1 preview" fill className="object-cover" />
                  </div>

                  <label className="block text-sm text-muted">Caption #1</label>
                  <input
                    className="input w-full"
                    value={pageCfg.winners.caption1}
                    onChange={(e) => setPageCfg((p) => ({ ...p, winners: { ...p.winners, caption1: e.target.value } }))}
                  />
                </div>

                {/* Winner #2 */}
                <div className="rounded-2xl border border-subtle bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Winners image #2</p>
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

                  <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                    <Image src={winners2Preview} alt="Winners #2 preview" fill className="object-cover" />
                  </div>

                  <label className="block text-sm text-muted">Caption #2</label>
                  <input
                    className="input w-full"
                    value={pageCfg.winners.caption2}
                    onChange={(e) => setPageCfg((p) => ({ ...p, winners: { ...p.winners, caption2: e.target.value } }))}
                  />
                </div>

                <button className="btn btn-primary w-full" type="button" onClick={saveUpdatesAndWinners} disabled={!canAct}>
                  {saving ? "Saving…" : "Save Updates + Winners"}
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-primary">Divisions & Leagues</h2>
                    <p className="text-sm text-muted">
                      {divisionCount} divisions • {leagueCount} leagues • Season <strong>{season}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      prefetch={false}
                      href={`/admin/mini-leagues/add-leagues?season=${encodeURIComponent(String(season))}`}
                      className="btn btn-outline"
                      title="Add leagues from Sleeper (search username → pick leagues)"
                    >
                      Add leagues
                    </Link>

                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={refreshStatusesAndCounts}
                      disabled={!canAct || refreshing}
                      title="Pull status + player counts from Sleeper for any league that has a leagueId"
                    >
                      {refreshing ? "Refreshing…" : "Refresh statuses + counts"}
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

              <div className="space-y-4">
                {divisions.map((d, divIdx) => {
                  const code = String(d.divisionCode || "");
                  const isOpen = openDivs.has(code);
                  const divImg = divisionPreviewSrc(d);

                  return (
                    <div key={`${code}-${divIdx}`} className="rounded-3xl border border-subtle bg-card-surface p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button type="button" className="flex items-center gap-3 text-left" onClick={() => toggleDiv(code)}>
                          <span className="text-lg font-semibold text-primary">{d.title || `Division ${code}`}</span>
                          <StatusPill status={d.status} />
                          <span className="text-xs text-muted">({Array.isArray(d.leagues) ? d.leagues.length : 0} leagues)</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button className="btn btn-outline text-sm" type="button" onClick={() => addLeague(divIdx)} disabled={!canAct}>
                            + League
                          </button>
                          <button className="btn btn-outline text-sm" type="button" onClick={() => removeDivision(divIdx)} disabled={!canAct}>
                            Delete Division
                          </button>
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="mt-4 space-y-5">
                          {/* ✅ Per-division rollover control (Big Game style) */}
                          <div className="rounded-2xl border border-subtle bg-black/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-sm font-semibold">Rollover this division</div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted">To Season</span>
                                <input
                                  className="input h-9 w-[110px] text-sm"
                                  type="number"
                                  value={rollYearByDiv[code] ?? String(season + 1)}
                                  onChange={(e) => setRollYearByDiv((prev) => ({ ...prev, [code]: e.target.value }))}
                                />
                                <button
                                  className="btn btn-primary text-sm"
                                  type="button"
                                  onClick={() => rolloverDivision(divIdx, rollYearByDiv[code] ?? String(season + 1))}
                                  disabled={!canAct}
                                >
                                  Rollover
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-muted">
                              Clears Sleeper URLs for this division and moves it into the target season dataset. Then click <strong>Save Divisions</strong> to publish.
                            </p>
                          </div>

                          {/* (rest of your editor unchanged) */}
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="block text-sm text-muted">Division Code</label>
                              <input
                                className="input w-full"
                                value={d.divisionCode}
                                onChange={(e) => updateDivision(divIdx, { divisionCode: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="block text-sm text-muted">Title</label>
                              <input className="input w-full" value={d.title} onChange={(e) => updateDivision(divIdx, { title: e.target.value })} />
                            </div>
<div className="space-y-2">
                              <label className="block text-sm text-muted">Order</label>
                              <input className="input w-full" type="number" value={d.order} onChange={(e) => updateDivision(divIdx, { order: Number(e.target.value) })} />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted">
                                  Division image {pendingDivisionFiles[`div:${code}`] ? <span className="text-amber-200">(pending)</span> : null}
                                </p>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    setPendingDivisionFiles((prev) => ({ ...prev, [`div:${code}`]: f }));
                                    e.target.value = "";
                                  }}
                                />
                              </div>

                              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                                {divImg ? <Image src={divImg} alt={`Division ${code} preview`} fill className="object-cover" /> : null}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-sm text-muted">Division Image URL (fallback)</label>
                              <input className="input w-full" value={d.imageUrl || ""} onChange={(e) => updateDivision(divIdx, { imageUrl: e.target.value })} />
                              <p className="text-xs text-muted">If you upload an image, the R2 key takes priority over this URL.</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {(Array.isArray(d.leagues) ? d.leagues : []).map((l, leagueIdx) => {
                              const lgImg = leaguePreviewSrc(code, l);
                              const pendingKey = `lg:${code}:${String(l.order ?? leagueIdx + 1)}`;

                              return (
                                <div key={`${code}-${leagueIdx}`} className="rounded-2xl border border-subtle bg-black/20 p-4 space-y-4">
                                  {(() => {
                                    const computedStatus = l.notReady ? "tbd" : (l.status || "tbd");
                                    const filled = Math.max(0, Number(l.filledTeams) || 0);
                                    const total = Math.max(0, Number(l.totalTeams) || 0);
                                    const open = Math.max(0, Number(l.openTeams) || 0);
                                    const hasCounts = total > 0;
                                    return (
                                      <>
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="text-sm font-semibold truncate">
                                                {l.name || `League #${l.order ?? leagueIdx + 1}`}
                                              </p>
                                              <StatusPill status={computedStatus} />
                                              {hasCounts ? (
                                                <span className="text-xs text-white/50">
                                                  {filled}/{total} teams • {open} open
                                                </span>
                                              ) : null}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                              <span className="font-mono">{l.leagueId || "—"}</span>
                                              {l.sleeperUrl ? (
                                                <a href={l.sleeperUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                                                  Open on Sleeper
                                                </a>
                                              ) : null}
                                            </div>
                                          </div>

                                          <div className="flex gap-2">
                                            <button
                                              className="btn btn-outline text-sm"
                                              type="button"
                                              onClick={() => removeLeague(divIdx, leagueIdx)}
                                              disabled={!canAct}
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-3">
                                          <div className="md:col-span-2 space-y-2">
                                            <label className="block text-sm text-muted">Invite URL (public link)</label>
                                            <input
                                              className="input w-full"
                                              value={l.url}
                                              onChange={(e) => updateLeague(divIdx, leagueIdx, { url: e.target.value })}
                                              placeholder="https://sleeper.com/i/…"
                                            />
                                          </div>

                                          <div className="space-y-2">
                                            <label className="block text-sm text-muted">Order</label>
                                            <input
                                              className="input w-full"
                                              type="number"
                                              value={l.order ?? leagueIdx + 1}
                                              onChange={(e) => updateLeague(divIdx, leagueIdx, { order: Number(e.target.value) })}
                                            />
                                          </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-3">
                                          <div className="space-y-2">
                                            <label className="block text-sm text-muted">Not Ready (forces TBD)</label>
                                            <select
                                              className="input w-full"
                                              value={l.notReady ? "yes" : "no"}
                                              onChange={(e) => {
                                                const v = e.target.value === "yes";
                                                updateLeague(divIdx, leagueIdx, {
                                                  notReady: v,
                                                  status: v ? "tbd" : (l.status || "tbd"),
                                                });
                                              }}
                                            >
                                              <option value="no">No</option>
                                              <option value="yes">Yes</option>
                                            </select>
                                            <p className="text-xs text-muted">Status is auto-synced from Sleeper. Use this only to hide leagues until ready.</p>
                                          </div>

                                          <div className="md:col-span-2">
                                            <details className="rounded-2xl border border-subtle bg-black/10 p-3">
                                              <summary className="cursor-pointer select-none text-sm font-semibold text-fg">
                                                League image (optional)
                                                {pendingLeagueFiles[pendingKey] ? (
                                                  <span className="ml-2 text-xs text-amber-200 align-middle">(pending)</span>
                                                ) : null}
                                              </summary>

                                              <div className="mt-3 space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                  <p className="text-xs text-muted">Upload replaces current image on save.</p>
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

                                                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                                                  {lgImg ? <Image src={lgImg} alt={`${l.name} preview`} fill className="object-cover" /> : null}
                                                </div>
                                              </div>
                                            </details>
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-2">
                            <button className="btn btn-primary w-full" type="button" onClick={saveDivisions} disabled={!canAct}>
                              {saving ? "Saving…" : "Save Divisions"}
                            </button>
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
