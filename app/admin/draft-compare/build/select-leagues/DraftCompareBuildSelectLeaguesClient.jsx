"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getADPGroupData } from "@/lib/adpBuild";
import { isRookieDraft } from "@/lib/sleeperApi";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeInt(v, fallback = null) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function cls(...a) {
  return a.filter(Boolean).join(" ");
}

async function apiGet(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function draftDisplayName(draft, leagueName) {
  const md = draft?.metadata || {};
  const name = safeStr(md?.name || md?.draft_name || "").trim();
  return name || leagueName || safeStr(draft?.draft_id || "Draft");
}

function statusPill(draft) {
  const status = safeStr(draft?.status || "").toLowerCase();
  if (status === "complete") return { text: "Complete", tone: "ok" };
  if (status === "in_progress") return { text: "In progress", tone: "warn" };
  if (status) return { text: status.replace(/_/g, " "), tone: "muted" };
  return { text: "Unknown", tone: "muted" };
}

function Pill({ tone = "muted", children }) {
  const toneCls =
    tone === "ok"
      ? "border-accent/25 bg-accent/10 text-accent"
      : tone === "warn"
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-border bg-background/30 text-muted";
  return <span className={cls("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", toneCls)}>{children}</span>;
}

export default function DraftCompareBuildSelectLeaguesClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const season = safeInt(sp.get("season"), null);
  const modeSlug = safeStr(sp.get("modeSlug")).trim();
  const title = safeStr(sp.get("title")).trim();
  const sleeperSeason = safeInt(sp.get("year"), null);
  const order = safeInt(sp.get("order"), null);
  const action = safeStr(sp.get("action")).trim() || "create";
  const username = safeStr(sp.get("username")).trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [leagues, setLeagues] = useState([]);
  const [draftsByLeague, setDraftsByLeague] = useState(() => ({}));
  const [selected, setSelected] = useState(() => new Set());
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState("");

  const canProceed = useMemo(() => {
    return (
      !!username &&
      !!modeSlug &&
      !!title &&
      Number.isFinite(season) &&
      Number.isFinite(sleeperSeason) &&
      selected.size > 0
    );
  }, [username, modeSlug, title, season, sleeperSeason, selected.size]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);
      try {
        const url = `/api/sleeper/leagues?username=${encodeURIComponent(username)}&season=${encodeURIComponent(
          String(sleeperSeason)
        )}&includeDrafts=0`;
        const data = await apiGet(url);
        if (cancelled) return;
        const list = Array.isArray(data?.leagues) ? data.leagues : [];

        list.sort((a, b) => {
          const ta =
            Number(a?.total_rosters || (a?.total_rosters === 0 ? a.total_rosters : a?.total_rosters)) ||
            Number(a?.total_rosters) ||
            0;
          const tb =
            Number(b?.total_rosters || (b?.total_rosters === 0 ? b.total_rosters : b?.total_rosters)) ||
            Number(b?.total_rosters) ||
            0;
          if (tb !== ta) return tb - ta;
          return safeStr(a?.name).localeCompare(safeStr(b?.name));
        });

        setLeagues(list);
        setSelected(new Set());

        setDraftsByLeague(() => {
          const next = {};
          for (const league of list) {
            const leagueId = safeStr(league?.league_id).trim();
            if (!leagueId) continue;
            next[leagueId] = { loading: true, drafts: [], error: "" };
          }
          return next;
        });

        const ids = list.map((league) => safeStr(league?.league_id).trim()).filter(Boolean);
        const concurrency = 6;
        let idx = 0;

        async function worker() {
          while (!cancelled && idx < ids.length) {
            const leagueId = ids[idx++];
            try {
              const dataForLeague = await apiGet(`/api/sleeper/drafts?leagueId=${encodeURIComponent(leagueId)}`);
              if (cancelled) return;
              const drafts = Array.isArray(dataForLeague?.drafts) ? dataForLeague.drafts : [];
              setDraftsByLeague((prev) => ({
                ...prev,
                [leagueId]: { loading: false, drafts, error: "" },
              }));
            } catch (e) {
              if (cancelled) return;
              setDraftsByLeague((prev) => ({
                ...prev,
                [leagueId]: { loading: false, drafts: [], error: String(e?.message || e) },
              }));
            }
          }
        }

        void Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
      } catch (e) {
        if (cancelled) return;
        setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [username, sleeperSeason]);

  const allSelectableKeys = useMemo(() => {
    const keys = [];
    for (const league of leagues) {
      const leagueId = safeStr(league?.league_id).trim();
      if (!leagueId) continue;
      const draftsState = draftsByLeague?.[leagueId];
      if (!draftsState || draftsState.loading) continue;
      const drafts = Array.isArray(draftsState?.drafts) ? draftsState.drafts : [];
      if (drafts.length) {
        for (const draft of drafts) {
          const draftId = safeStr(draft?.draft_id).trim();
          if (draftId) keys.push(`${leagueId}::${draftId}`);
        }
      } else {
        keys.push(leagueId);
      }
    }
    return keys;
  }, [draftsByLeague, leagues]);

  const allDraftLookupsSettled = useMemo(() => {
    if (!leagues.length) return false;
    return leagues.every((league) => {
      const leagueId = safeStr(league?.league_id).trim();
      return leagueId ? !draftsByLeague?.[leagueId]?.loading : true;
    });
  }, [draftsByLeague, leagues]);

  function toggleKey(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allSelectableKeys));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function selectionMetaMap() {
    const out = new Map();
    for (const league of leagues) {
      const leagueId = safeStr(league?.league_id).trim();
      const leagueName = safeStr(league?.name).trim();
      const drafts = Array.isArray(draftsByLeague?.[leagueId]?.drafts) ? draftsByLeague[leagueId].drafts : [];

      for (const draft of drafts) {
        const draftId = safeStr(draft?.draft_id).trim();
        if (!leagueId || !draftId) continue;
        const key = `${leagueId}::${draftId}`;
        out.set(key, {
          leagueId,
          draftId,
          leagueName,
          draftName: draftDisplayName(draft, leagueName),
          rookie: isRookieDraft(draft),
          status: safeStr(draft?.status).trim(),
        });
      }

      if (leagueId && drafts.length === 0) {
        out.set(leagueId, {
          leagueId,
          draftId: null,
          leagueName,
          draftName: leagueName || leagueId,
          rookie: false,
          status: "",
        });
      }
    }
    return out;
  }

  async function buildAndSave() {
    setErr("");
    setBuildMsg("");
    if (!canProceed) return;

    const keys = Array.from(selected);
    const metaMap = selectionMetaMap();

    try {
      setBuilding(true);
      setBuildMsg("Building ADP and draftboard data from Sleeper drafts...");

      const group = await getADPGroupData(keys);

      const leaguesOut = (group?.leagues || []).map((league) => {
        const key = league?.draftId ? `${league.leagueId}::${league.draftId}` : safeStr(league?.leagueId);
        const meta = metaMap.get(key);
        return {
          ...league,
          leagueName: meta?.leagueName || league?.name || league?.leagueId,
          draftName: meta?.draftName || league?.name || league?.leagueId,
          isRookie: !!meta?.rookie,
          selectionKey: key,
        };
      });

      const payload = {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        modeSlug,
        title,
        order,
        sleeperSeason,
        source: { username },
        meta: group?.meta || { teams: 12, rounds: 15 },
        leagues: leaguesOut,
        selectedKeys: keys,
      };

      setBuildMsg("Saving JSON to Ballsville...");
      await apiPost("/api/admin/draft-compare", {
        season,
        type: "drafts",
        modeSlug,
        data: payload,
      });

      setBuildMsg("Saved! Returning to Draft Compare Admin...");
      router.push("/admin/draft-compare");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <section className="section">
      <div className="container-site">
        <div className="rounded-3xl border border-border bg-card-surface p-6 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-muted">Draft Compare - Build</div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Select Leagues</h1>
              <p className="mt-2 text-sm text-muted">
                Mode: <span className="font-semibold text-primary">{title || "-"}</span> - Sleeper season:{" "}
                <span className="font-semibold text-primary">{sleeperSeason || "-"}</span> - User:{" "}
                <span className="font-semibold text-primary">{username || "-"}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                Pick the exact drafts you want included. Main and rookie drafts are both supported.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                prefetch={false}
                className="btn btn-secondary"
                href={`/admin/draft-compare/build?season=${encodeURIComponent(String(season || ""))}&modeSlug=${encodeURIComponent(
                  modeSlug
                )}&title=${encodeURIComponent(title)}&year=${encodeURIComponent(String(sleeperSeason || ""))}&order=${encodeURIComponent(
                  String(order || "")
                )}&action=${encodeURIComponent(action)}`}
              >
                Back
              </Link>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Selected drafts: <span className="font-semibold text-primary">{selected.size}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cls("btn btn-secondary", !allDraftLookupsSettled ? "opacity-50" : "")}
                disabled={!allDraftLookupsSettled || building || allSelectableKeys.length === 0}
                onClick={selectAll}
                title={allDraftLookupsSettled ? "" : "Select all becomes available once all draft lookups finish loading."}
              >
                Select All
              </button>
              <button
                type="button"
                className={cls("btn btn-secondary", selected.size === 0 ? "opacity-50" : "")}
                disabled={selected.size === 0 || building}
                onClick={clearAll}
              >
                Clear
              </button>
              <button
                className={cls("btn", canProceed && !building ? "btn-primary" : "btn-primary opacity-50")}
                disabled={!canProceed || building}
                onClick={buildAndSave}
              >
                {building ? "Building..." : "Build & Save"}
              </button>
            </div>
          </div>

          {!loading && leagues.length > 0 ? (
            <div className="mt-3 text-xs text-muted">
              {allDraftLookupsSettled
                ? `Select All will pick every available draft for this rebuild (${allSelectableKeys.length} total).`
                : "Drafts are still loading. Select All will unlock when every league has finished loading its draft list."}
            </div>
          ) : null}

          {buildMsg ? <div className="mt-3 text-sm text-muted">{buildMsg}</div> : null}

          <div className="mt-6 grid gap-4">
            {loading ? (
              <div className="rounded-2xl border border-border bg-background/30 p-6 text-sm text-muted">Loading leagues...</div>
            ) : null}

            {!loading && leagues.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/30 p-6 text-sm text-muted">
                No leagues found for this user and season.
              </div>
            ) : null}

            {!loading
              ? leagues.map((league) => {
                  const leagueId = safeStr(league?.league_id).trim();
                  const leagueName = safeStr(league?.name).trim() || leagueId;
                  const draftsState = draftsByLeague?.[leagueId] || { loading: true, drafts: [], error: "" };
                  const drafts = Array.isArray(draftsState?.drafts) ? draftsState.drafts : [];
                  const hasDrafts = drafts.length > 0;

                  return (
                    <div key={leagueId} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-primary">{leagueName}</div>
                          <div className="mt-1 text-xs text-muted">League ID: {leagueId}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill>{safeStr(league?.total_rosters || "").trim() ? `${league.total_rosters} teams` : ""}</Pill>
                          <Pill>{safeStr(league?.season || "").trim() || String(sleeperSeason || "")}</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {draftsState.loading ? (
                          <div className="rounded-xl border border-border bg-background/10 p-3 text-xs text-muted">Loading drafts...</div>
                        ) : null}

                        {!draftsState.loading && draftsState.error ? (
                          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                            Failed to load drafts for this league. You can still select the automatic primary draft fallback.
                          </div>
                        ) : null}

                        {hasDrafts
                          ? drafts
                              .slice()
                              .sort((a, b) => {
                                const ra = isRookieDraft(a) ? 1 : 0;
                                const rb = isRookieDraft(b) ? 1 : 0;
                                if (ra !== rb) return rb - ra;
                                const ta = Number(a?.last_picked || a?.start_time || a?.created || 0);
                                const tb = Number(b?.last_picked || b?.start_time || b?.created || 0);
                                return tb - ta;
                              })
                              .map((draft) => {
                                const draftId = safeStr(draft?.draft_id).trim();
                                const key = `${leagueId}::${draftId}`;
                                const checked = selected.has(key);
                                const rookie = isRookieDraft(draft);
                                const status = statusPill(draft);
                                return (
                                  <label
                                    key={key}
                                    className={cls(
                                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3",
                                      checked ? "border-primary/40 bg-primary/5" : "border-border bg-background/10"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input type="checkbox" checked={checked} onChange={() => toggleKey(key)} />
                                      <div>
                                        <div className="text-sm font-semibold text-primary">{draftDisplayName(draft, leagueName)}</div>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          <Pill tone={status.tone}>{status.text}</Pill>
                                          {rookie ? <Pill tone="warn">Rookie</Pill> : <Pill>Main</Pill>}
                                          <Pill>
                                            {Number.isFinite(Number(draft?.settings?.teams)) ? `${draft.settings.teams}T` : "-"} /{" "}
                                            {Number.isFinite(Number(draft?.settings?.rounds)) ? `${draft.settings.rounds}R` : "-"}
                                          </Pill>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted">{draftId}</div>
                                  </label>
                                );
                              })
                          : (
                            <label
                              className={cls(
                                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3",
                                selected.has(leagueId) ? "border-primary/40 bg-primary/5" : "border-border bg-background/10"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={selected.has(leagueId)} onChange={() => toggleKey(leagueId)} />
                                <div>
                                  <div className="text-sm font-semibold text-primary">Use primary draft (auto)</div>
                                  <div className="mt-1 text-xs text-muted">
                                    {draftsState.loading
                                      ? "Drafts are still loading..."
                                      : draftsState.error
                                        ? "Drafts failed to load. Primary draft selection still works."
                                        : "No drafts list was returned for this league."}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-muted">{leagueId}</div>
                            </label>
                          )}
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </div>
    </section>
  );
}
