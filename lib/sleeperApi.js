// lib/sleeperApi.js
// Sleeper API helpers (fetch-only, works in browser + Cloudflare functions)

const BASE = "https://api.sleeper.app/v1";

const CACHE_TTL_MS = 5 * 60 * 1000;
function isFresh(ts) {
  return Date.now() - ts < CACHE_TTL_MS;
}

const leagueDraftsCache = new Map(); // leagueId -> {ts,data}
const leagueDraftsInflight = new Map(); // leagueId -> Promise

const draftPicksCache = new Map(); // draftId -> {ts,data}
const draftPicksInflight = new Map(); // draftId -> Promise

class SleeperHttpError extends Error {
  constructor(message, status, url, bodyText) {
    super(message);
    this.name = "SleeperHttpError";
    this.status = status;
    this.url = url;
    this.bodyText = bodyText;
  }
}

async function fetchJson(url, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 15000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new SleeperHttpError(`Sleeper HTTP ${res.status}`, res.status, url, bodyText);
    }

    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function getUserId(username) {
  const u = String(username || "").trim();
  if (!u) throw new Error("Missing username");
  const url = `${BASE}/user/${encodeURIComponent(u)}`;
  const user = await fetchJson(url);
  const id = String(user?.user_id || "").trim();
  if (!id) throw new Error("User not found");
  return id;
}

export async function getUserLeagues(username, season) {
  const userId = await getUserId(username);
  const s = String(season || "").trim();
  if (!s) throw new Error("Missing season");
  const url = `${BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(s)}`;
  return await fetchJson(url);
}

export async function getLeagueDrafts(leagueId) {
  const id = String(leagueId || "").trim();
  if (!id) return [];

  const cached = leagueDraftsCache.get(id);
  if (cached && isFresh(cached.ts)) return cached.data;

  const inflight = leagueDraftsInflight.get(id);
  if (inflight) return inflight;

  const url = `${BASE}/league/${encodeURIComponent(id)}/drafts`;

  const p = (async () => {
    try {
      const data = await fetchJson(url);
      leagueDraftsCache.set(id, { ts: Date.now(), data });
      return data;
    } catch (e) {
      if (e?.name === "SleeperHttpError" && e?.status === 404) {
        leagueDraftsCache.set(id, { ts: Date.now(), data: [] });
        return [];
      }
      throw e;
    } finally {
      leagueDraftsInflight.delete(id);
    }
  })();

  leagueDraftsInflight.set(id, p);
  return p;
}

export function isRookieDraft(draft) {
  if (!draft) return false;
  const t = String(draft?.type || "").toLowerCase();
  if (t.includes("rookie")) return true;

  const md = draft?.metadata || {};
  const name = String(md?.name || md?.draft_name || "").toLowerCase();
  const desc = String(md?.description || "").toLowerCase();
  return name.includes("rookie") || desc.includes("rookie");
}

export async function getLeagueDraftById(leagueId, draftId) {
  const id = String(leagueId || "").trim();
  const did = String(draftId || "").trim();
  if (!id || !did) return null;
  const drafts = await getLeagueDrafts(id);
  return drafts.find((d) => String(d?.draft_id) === did) || null;
}

// Default: prefer most recently active *complete* draft, otherwise most recent overall.
export async function getLeaguePrimaryDraft(leagueId) {
  const drafts = await getLeagueDrafts(leagueId);
  if (!drafts?.length) return null;

  const isComplete = (d) => String(d?.status || "").toLowerCase() === "complete";
  const recency = (d) => {
    const a = typeof d?.last_picked === "number" ? d.last_picked : 0;
    const b = typeof d?.start_time === "number" ? d.start_time : 0;
    const c = typeof d?.created === "number" ? d.created : 0;
    return Math.max(a, b, c, 0);
  };

  const complete = drafts.filter(isComplete).slice().sort((x, y) => recency(y) - recency(x));
  if (complete.length) return complete[0] || null;

  const any = drafts.slice().sort((x, y) => recency(y) - recency(x));
  return any[0] || null;
}

export async function getDraftPicks(draftId) {
  const id = String(draftId || "").trim();
  if (!id) return [];

  const cached = draftPicksCache.get(id);
  if (cached && isFresh(cached.ts)) return cached.data;

  const inflight = draftPicksInflight.get(id);
  if (inflight) return inflight;

  const url = `${BASE}/draft/${encodeURIComponent(id)}/picks`;

  const p = (async () => {
    try {
      const data = await fetchJson(url);
      draftPicksCache.set(id, { ts: Date.now(), data });
      return data;
    } catch (e) {
      if (e?.name === "SleeperHttpError" && (e?.status === 404 || e?.status === 400)) {
        draftPicksCache.set(id, { ts: Date.now(), data: [] });
        return [];
      }
      throw e;
    } finally {
      draftPicksInflight.delete(id);
    }
  })();

  draftPicksInflight.set(id, p);
  return p;
}
