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

function draftDisplayName(d, leagueName) {
  const md = d?.metadata || {};
  const name = safeStr(md?.name || md?.draft_name || "").trim();
  return name || leagueName || safeStr(d?.draft_id || "Draft");
}

function statusPill(d) {
  const s = safeStr(d?.status || "").toLowerCase();
  if (s === "complete") return { text: "Complete", tone: "ok" };
  if (s === "in_progress") return { text: "In progress", tone: "warn" };
  if (s) return { text: s.replace(/_/g, " "), tone: "muted" };
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

export default function DraftCompareBuildSelectLeaguesPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const season = safeInt(sp.get("season"), null); // Ballsville season bucket (R2)
  const modeSlug = safeStr(sp.get("modeSlug")).trim();
  const title = safeStr(sp.get("title")).trim();
  const sleeperSeason = safeInt(sp.get("year"), null); // Sleeper season to pull leagues from
  const order = safeInt(sp.get("order"), null);
  const action = safeStr(sp.get("action")).trim() || "create";
  const username = safeStr(sp.get("username")).trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [leagues, setLeagues] = useState([]);

  const [selected, setSelected] = useState(() => new Set()); // key leagueId::draftId
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState("");

  const canProceed = useMemo(() => {
    return !!username && !!modeSlug && !!title && Number.isFinite(season) && Number.isFinite(sleeperSeason) && selected.size > 0;
  }, [username, modeSlug, title, season, sleeperSeason, selected.size]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      setLoading(true);
      try {
        const url = `/api/sleeper/leagues?username=${encodeURIComponent(username)}&season=${encodeURIComponent(
          String(sleeperSeason)
        )}`;
        const data = await apiGet(url);
        if (cancelled) return;
        const list = Array.isArray(data?.leagues) ? data.leagues : [];
        // Sort: most rosters first, then name
        list.sort((a, b) => {
          const ta = Number(a?.total_rosters || a?.total_rosters === 0 ? a.total_rosters : a?.total_rosters) || Number(a?.total_rosters) || 0;
          const tb = Number(b?.total_rosters || b?.total_rosters === 0 ? b.total_rosters : b?.total_rosters) || Number(b?.total_rosters) || 0;
          if (tb !== ta) return tb - ta;
          return safeStr(a?.name).localeCompare(safeStr(b?.name));
        });
        setLeagues(list);
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

  function toggleKey(k) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function selectionMetaMap() {
    const out = new Map();
    for (const l of leagues) {
      const leagueId = safeStr(l?.league_id).trim();
      const leagueName = safeStr(l?.name).trim();
      const drafts = Array.isArray(l?.drafts) ? l.drafts : [];
      for (const d of drafts) {
        const draftId = safeStr(d?.draft_id).trim();
        if (!leagueId || !draftId) continue;
        const key = `${leagueId}::${draftId}`;
        const rookie = isRookieDraft(d);
        out.set(key, {
          leagueId,
          draftId,
          leagueName,
          draftName: draftDisplayName(d, leagueName),
          rookie,
          status: safeStr(d?.status).trim(),
        });
      }
      // If Sleeper returned no drafts (rare), still let user select "primary" via leagueId only.
      if (leagueId && (!drafts || drafts.length === 0)) {
        const key = leagueId;
        out.set(key, {
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
      setBuildMsg("Building ADP + draftboard data from Sleeper drafts…");

      const group = await getADPGroupData(keys);

      // Enrich per-league entries with draft selection metadata (rookie tag, league name, etc.)
      const leaguesOut = (group?.leagues || []).map((l) => {
        const k = l?.draftId ? `${l.leagueId}::${l.draftId}` : safeStr(l?.leagueId);
        const m = metaMap.get(k);
        return {
          ...l,
          leagueName: m?.leagueName || l?.name || l?.leagueId,
          draftName: m?.draftName || l?.name,
          isRookie: !!m?.rookie,
          selectionKey: k,
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
        // Keep these so we can reproduce / audit exactly what was selected later
        selectedKeys: keys,
      };

      setBuildMsg("Saving JSON to Ballsville…");
      await apiPost("/api/admin/draft-compare", {
        season,
        type: "drafts",
        modeSlug,
        data: payload,
      });

      // Also ensure this mode exists/updates in modes_<season>.json so it shows up immediately.
      // We only touch the core fields; everything else (subtitle/image) is preserved if present.
      setBuildMsg("Updating Draft Compare modes list…");
      const modes = await apiGet(`/api/admin/draft-compare?season=${encodeURIComponent(String(season))}&type=modes`);
      const rows = Array.isArray(modes?.rows) ? modes.rows : [];

      const idx = rows.findIndex((r) => safeStr(r?.modeSlug).trim() === modeSlug);
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          modeSlug,
          title,
          order,
          year: sleeperSeason,
        };
      } else {
        rows.push({
          modeSlug,
          title,
          subtitle: "",
          order,
          year: sleeperSeason,
          imageKey: "",
          image_url: "",
        });
      }

      // Keep it tidy + deterministic
      rows.sort((a, b) => {
        const oa = safeInt(a?.order, 0) ?? 0;
        const ob = safeInt(b?.order, 0) ?? 0;
        if (oa !== ob) return oa - ob;
        return safeStr(a?.title).localeCompare(safeStr(b?.title));
      });

      await apiPost("/api/admin/draft-compare", {
        season,
        type: "modes",
        rows,
      });

      setBuildMsg("Saved! Returning to Draft Compare Admin…");
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
        <div className="rounded-3xl border border-border bg-card-surface/80 p-6 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-muted">Draft Compare • Build</div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Select Leagues</h1>
              <p className="mt-2 text-sm text-muted">
                Mode: <span className="font-semibold text-primary">{title || "—"}</span> • Sleeper season:{" "}
                <span className="font-semibold text-primary">{sleeperSeason || "—"}</span> • User:{" "}
                <span className="font-semibold text-primary">{username || "—"}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                Pick the exact drafts you want included (main + rookie supported). Then we’ll build + save the JSON automatically.
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

          {err ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{err}</div> : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Selected drafts: <span className="font-semibold text-primary">{selected.size}</span>
            </div>
            <button
              className={cls("btn", canProceed && !building ? "btn-primary" : "btn-primary opacity-50")}
              disabled={!canProceed || building}
              onClick={buildAndSave}
            >
              {building ? "Building…" : "Build & Save"}
            </button>
          </div>

          {buildMsg ? <div className="mt-3 text-sm text-muted">{buildMsg}</div> : null}

          <div className="mt-6 grid gap-4">
            {loading ? (
              <div className="rounded-2xl border border-border bg-background/30 p-6 text-sm text-muted">Loading leagues…</div>
            ) : null}

            {!loading && leagues.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/30 p-6 text-sm text-muted">No leagues found for this user/season.</div>
            ) : null}

            {!loading
              ? leagues.map((l) => {
                  const leagueId = safeStr(l?.league_id).trim();
                  const leagueName = safeStr(l?.name).trim() || leagueId;
                  const drafts = Array.isArray(l?.drafts) ? l.drafts : [];

                  const hasDrafts = drafts.length > 0;

                  return (
                    <div key={leagueId} className="rounded-2xl border border-border bg-background/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-primary">{leagueName}</div>
                          <div className="mt-1 text-xs text-muted">League ID: {leagueId}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill>{safeStr(l?.total_rosters || "").trim() ? `${l.total_rosters} teams` : ""}</Pill>
                          <Pill>{safeStr(l?.season || "").trim() || String(sleeperSeason || "")}</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {hasDrafts
                          ? drafts
                              .slice()
                              .sort((a, b) => {
                                const ra = isRookieDraft(a) ? 1 : 0;
                                const rb = isRookieDraft(b) ? 1 : 0;
                                if (ra !== rb) return rb - ra; // rookie first
                                const ta = Number(a?.last_picked || a?.start_time || a?.created || 0);
                                const tb = Number(b?.last_picked || b?.start_time || b?.created || 0);
                                return tb - ta;
                              })
                              .map((d) => {
                                const draftId = safeStr(d?.draft_id).trim();
                                const key = `${leagueId}::${draftId}`;
                                const checked = selected.has(key);
                                const rookie = isRookieDraft(d);
                                const st = statusPill(d);
                                return (
                                  <label
                                    key={key}
                                    className={cls(
                                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3",
                                      checked ? "border-primary/40 bg-primary/5" : "border-border bg-background/10"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleKey(key)}
                                      />
                                      <div>
                                        <div className="text-sm font-semibold text-primary">
                                          {draftDisplayName(d, leagueName)}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          <Pill tone={st.tone}>{st.text}</Pill>
                                          {rookie ? <Pill tone="warn">Rookie</Pill> : <Pill>Main</Pill>}
                                          <Pill>
                                            {Number.isFinite(Number(d?.settings?.teams)) ? `${d.settings.teams}T` : "—"} /{" "}
                                            {Number.isFinite(Number(d?.settings?.rounds)) ? `${d.settings.rounds}R` : "—"}
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
                                    <div className="mt-1 text-xs text-muted">No drafts list returned by Sleeper for this league.</div>
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
